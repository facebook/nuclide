/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 */

import type {LRUCache} from 'lru-cache';

import LRU from 'lru-cache';
import {CompositeDisposable} from 'event-kit';

import nuclideUri from 'nuclide-commons/nuclideUri';
import which from 'nuclide-commons/which';
import {runCommand} from 'nuclide-commons/process';
import {ConfigCache} from 'nuclide-commons/ConfigCache';

const FLOW_BIN_PATH = 'node_modules/.bin/flow';

type FlowVersionInfo = {
  pathToFlow: string,
  flowVersion: string,
};

// All the information needed to execute Flow in a given root. The path to the Flow binary we want
// to use may vary per root -- for now, only if we are using the version of Flow from `flow-bin`.
// The options also vary, right now only because they set the cwd to the current Flow root.
export type FlowExecInfo = {
  pathToFlow: string,
  flowVersion: string,
  execOptions: Object,
};

export class FlowExecInfoContainer {
  // Map from file path to the closest ancestor directory containing a .flowconfig file (the file's
  // Flow root)
  _flowConfigDirCache: ConfigCache;

  // Map from Flow root directory (or null for "no root" e.g. files outside of a Flow root, or
  // unsaved files. Useful for outline view) to FlowExecInfo. A null value means that the Flow
  // binary cannot be found for that root. It is possible for Flow to be available in some roots but
  // not others because we will support root-specific installations of flow-bin.
  _flowExecInfoCache: LRUCache<?string, ?FlowExecInfo>;

  _disposables: CompositeDisposable;

  _pathToFlow: string;
  _canUseFlowBin: boolean;
  _versionInfo: ?FlowVersionInfo;

  constructor(versionInfo: ?FlowVersionInfo) {
    this._flowConfigDirCache = new ConfigCache('.flowconfig');

    this._flowExecInfoCache = LRU({
      max: 10,
      maxAge: 1000 * 30, // 30 seconds
    });

    this._disposables = new CompositeDisposable();
    this._versionInfo = versionInfo;

    this._observeSettings();
  }

  dispose() {
    this._disposables.dispose();
    this._flowConfigDirCache.dispose();
    this._flowExecInfoCache.reset();
  }

  // Returns null iff Flow cannot be found.
  async getFlowExecInfo(root: string | null): Promise<?FlowExecInfo> {
    if (!this._flowExecInfoCache.has(root)) {
      const info = await this._computeFlowExecInfo(root);
      this._flowExecInfoCache.set(root, info);
    }
    return this._flowExecInfoCache.get(root);
  }

  reallyGetFlowExecInfo(root: string | null): Promise<?FlowExecInfo> {
    this._flowExecInfoCache.del(root);
    return this.getFlowExecInfo(root);
  }

  async _computeFlowExecInfo(root: string | null): Promise<?FlowExecInfo> {
    let versionInfo;
    if (this._versionInfo == null) {
      const flowPath = await this._getPathToFlow(root);
      if (flowPath == null) {
        return null;
      }
      versionInfo = await getFlowVersionInformation(flowPath, root);
      if (versionInfo == null) {
        return null;
      }
    } else {
      versionInfo = this._versionInfo;
    }

    return {
      ...versionInfo,
      execOptions: getFlowExecOptions(root),
    };
  }

  // Return the path we should use to execute Flow for the given root, or null if Flow cannot be
  // found.
  async _getPathToFlow(root: string | null): Promise<?string> {
    const flowBinPath = await this._getFlowBinPath(root);
    if (flowBinPath != null && (await canFindFlow(flowBinPath))) {
      return flowBinPath;
    }

    // Pull this into a local on the off chance that the setting changes while we are doing the
    // check.
    const systemFlowPath = this._pathToFlow;

    // If on Windows, prefer the .cmd wrapper for flow if it's available.
    if (process.platform === 'win32') {
      const cmdPath = systemFlowPath + '.cmd';
      if (await canFindFlow(systemFlowPath)) {
        return cmdPath;
      }
    }

    if (await canFindFlow(systemFlowPath)) {
      return systemFlowPath;
    }

    return null;
  }

  async _getFlowBinPath(root: string | null): Promise<?string> {
    if (root == null) {
      return null;
    }
    if (!this._canUseFlowBin) {
      return null;
    }
    // If we are running on Windows, we should use the .cmd version of flow.
    if (process.platform === 'win32') {
      return nuclideUri.join(root, FLOW_BIN_PATH + '.cmd');
    }
    return nuclideUri.join(root, FLOW_BIN_PATH);
  }

  async findFlowConfigDir(localFile: string): Promise<?string> {
    return this._flowConfigDirCache.getConfigDir(localFile);
  }

  _observeSettings(): void {
    if (global.atom == null) {
      this._pathToFlow = 'flow';
      this._canUseFlowBin = false;
    } else {
      // $UPFixMe: This should use nuclide-features-config
      // Does not currently do so because this is an npm module that may run on the server.
      this._disposables.add(
        atom.config.observe('nuclide.nuclide-flow.pathToFlow', path => {
          this._pathToFlow = path;
          this._flowExecInfoCache.reset();
        }),
        atom.config.observe(
          'nuclide.nuclide-flow.canUseFlowBin',
          canUseFlowBin => {
            this._canUseFlowBin = canUseFlowBin;
            this._flowExecInfoCache.reset();
          },
        ),
      );
    }
  }
}

async function getFlowVersionInformation(
  flowPath: string,
  root: string | null,
): Promise<?{flowVersion: string, pathToFlow: string}> {
  try {
    const result = await runCommand(
      flowPath,
      ['version', '--json'],
      root != null ? {cwd: root} : undefined,
    ).toPromise();
    const json = JSON.parse(result);
    return {
      flowVersion: json.semver,
      pathToFlow: json.binary,
    };
  } catch (e) {
    return null;
  }
}

async function canFindFlow(flowPath: string): Promise<boolean> {
  if (process.platform === 'win32') {
    // On Windows, if the flow path is configured as a full path rather than just "flow" or
    // "flow.exe", format the path correctly to pass to `where <flow>`
    const dirPath = nuclideUri.dirname(flowPath);
    if (dirPath != null && dirPath !== '' && dirPath !== '.') {
      const whichPath = `${nuclideUri.dirname(flowPath)}:${nuclideUri.basename(
        flowPath,
      )}`;
      return (await which(whichPath)) != null;
    }
  }

  return (await which(flowPath)) != null;
}

// `string | null` forces the presence of an explicit argument (`?string` allows undefined which
// means the argument can be left off altogether.
function getFlowExecOptions(root: string | null): Object {
  return {
    cwd: root,
    env: {
      // Allows backtrace to be printed:
      // http://caml.inria.fr/pub/docs/manual-ocaml/runtime.html#sec279
      OCAMLRUNPARAM: 'b',
      // Put this after so that if the user already has something set for OCAMLRUNPARAM we use
      // that instead. They probably know what they're doing.
      ...process.env,
    },
  };
}
