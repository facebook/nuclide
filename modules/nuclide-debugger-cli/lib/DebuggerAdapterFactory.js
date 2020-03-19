/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {DebugAdapter} from './DebugAdapter';
import type {
  LaunchRequestArguments,
  AttachRequestArguments,
} from 'vscode-debugprotocol';
import type {
  DebuggerConfigAction,
  VSAdapterExecutableInfo,
  VsAdapterType,
} from 'nuclide-debugger-common';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {objectFromMap} from 'nuclide-commons/collection';
import {
  getAdapterExecutable,
  getAdapterPackageRoot,
} from 'nuclide-debugger-common/debugger-registry';
import VSPOptionsParser from './VSPOptionsParser';

import HHVMDebugAdapter from './adapters/HHVMDebugAdapter';
import NativeGdbDebugAdapter from './adapters/NativeGdbDebugAdapter';
import NodeDebugAdapter from './adapters/NodeDebugAdapter';
import PythonDebugAdapter from './adapters/PythonDebugAdapter';

export type ParsedVSAdapter = {
  action: DebuggerConfigAction,
  type: VsAdapterType,
  adapterInfo: VSAdapterExecutableInfo,
  launchArgs?: LaunchRequestArguments,
  attachArgs?: AttachRequestArguments,
  adapter: DebugAdapter,
};

export type Arguments = {
  _: string[],
  type?: string,
  attach: boolean,
};

export default class DebuggerAdapterFactory {
  _debugAdapters: Array<DebugAdapter> = [
    new HHVMDebugAdapter(),
    new NativeGdbDebugAdapter(),
    new NodeDebugAdapter(),
    new PythonDebugAdapter(),
  ];

  allAdapterKeys(): string[] {
    return this._debugAdapters.map(adapt => adapt.key);
  }

  adapterFromArguments(args: Arguments): Promise<?ParsedVSAdapter> {
    // if there's --attach, but also a program, assume they really meant
    // to launch the program
    if (args._[0] != null) {
      try {
        return this._parseLaunchArguments(args);
      } catch (_) {}
    }

    if (args.attach) {
      return this._parseAttachArguments(args);
    }

    return this._parseLaunchArguments(args);
  }

  contextSensitiveHelp(args: Arguments): Array<string> {
    const adapter = this._adapterFromCommandLine(args);
    if (adapter == null) {
      return [];
    }

    const root = getAdapterPackageRoot(adapter.key);
    const optionsParser = new VSPOptionsParser(root);
    const action: DebuggerConfigAction = args.attach ? 'attach' : 'launch';

    return optionsParser.commandLineHelp(
      adapter.type,
      action,
      adapter.excludedOptions,
      adapter.customArguments,
    );
  }

  async _parseAttachArguments(args: Arguments): Promise<?ParsedVSAdapter> {
    const adapter = await this._adapterFromCommandLine(args);

    if (adapter == null) {
      throw new Error(
        'Debugger type not specified; please use "--type" to specify it.',
      );
    }

    const commandLineArgs = adapter.parseArguments(args);

    return {
      action: 'attach',
      type: adapter.key,
      adapterInfo: getAdapterExecutable(adapter.key),
      attachArgs: objectFromMap(commandLineArgs),
      adapter,
    };
  }

  async _parseLaunchArguments(args: Arguments): Promise<?ParsedVSAdapter> {
    const launchArgs = args._;
    const program = launchArgs[0];

    if (program == null) {
      throw new Error(
        '--attach not specified and no program to debug specified on the command line.',
      );
    }

    const adapter =
      this._adapterFromCommandLine(args) ||
      (await this._adapterFromProgramName(program));

    if (adapter == null) {
      throw new Error(
        'Could not determine the type of program being debugged. Please specifiy with the "--type" option.',
      );
    }

    delete args.attach;
    const commandLineArgs = adapter.parseArguments(args);

    return {
      action: 'launch',
      type: adapter.key,
      adapterInfo: getAdapterExecutable(adapter.key),
      launchArgs: objectFromMap(commandLineArgs),
      adapter,
    };
  }

  _adapterFromCommandLine(args: Arguments): ?DebugAdapter {
    const type = args.type;
    if (type != null) {
      const adapter = this._debugAdapters.find(a => a.key === type);

      if (adapter == null) {
        const validAdapters = this._debugAdapters.map(a => a.key).join('", "');
        throw new Error(
          `Invalid target type "${type}"; valid types are "${validAdapters}".`,
        );
      }

      return adapter;
    }

    return null;
  }

  async _adapterFromProgramName(program: string): Promise<DebugAdapter> {
    const programUri = nuclideUri.parsePath(program);
    const ext = programUri.ext;

    const canDebug: Array<boolean> = await Promise.all(
      this._debugAdapters.map(a => a.canDebugFile(program)),
    );

    const adapters = this._debugAdapters.filter(
      (a, idx) => a.extensions.has(ext) || canDebug[idx],
    );

    if (adapters.length > 1) {
      throw new Error(
        `Multiple debuggers can debug programs with extension ${ext}. Please explicitly specify one with '--type'`,
      );
    }

    return adapters[0];
  }
}
