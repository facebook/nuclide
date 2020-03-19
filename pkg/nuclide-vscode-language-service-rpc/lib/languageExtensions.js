/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {PublishDiagnosticsParams} from './protocol';
import type {HostServices} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {StatusData} from '../../nuclide-language-service/lib/LanguageService';

import semver from 'semver';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {asyncFind} from 'nuclide-commons/promise';
import which from 'nuclide-commons/which';
import {runCommand} from 'nuclide-commons/process';

export async function getLanguageSpecificCommand(
  rootPath: string,
  options: mixed,
): Promise<string> {
  if (
    typeof options === 'object' &&
    options != null &&
    options.kind === 'flow' &&
    typeof options.canUseFlowBin === 'boolean' &&
    typeof options.pathToFlow === 'string'
  ) {
    const win32 = process.platform === 'win32';
    const cwd = {cwd: rootPath};
    const candidates = [];
    if (options.canUseFlowBin && win32) {
      candidates.push(
        nuclideUri.join(rootPath, './node_modules/.bin/flow.cmd'),
      );
    }
    if (options.canUseFlowBin) {
      candidates.push(nuclideUri.join(rootPath, './node_modules/.bin/flow'));
    }
    if (win32) {
      candidates.push(`${options.pathToFlow}.cmd`);
    }
    candidates.push(options.pathToFlow);

    const command = await asyncFind(candidates, async candidate => {
      const exists = (await which(candidate, cwd)) != null;
      return exists ? candidate : null;
    });

    if (command == null) {
      throw new Error(
        `Flow not found at ${candidates
          .map(candidate => `"${candidate}"`)
          .join(', ')}`,
      );
    }

    const versionRaw = await runCommand(
      command,
      ['version', '--json'],
      cwd,
    ).toPromise();
    const versionJson = JSON.parse(versionRaw);
    const version = versionJson.semver;
    if (!semver.satisfies(version, '>=0.75.0')) {
      let msg = `Flow version is ${version}, which is too old for Nuclide support - please upgrade to 0.75.0 or higher.`;
      try {
        // $FlowFB
        const strings = require('./fb-strings');
        msg = await strings.flowVersionTooOld(version, rootPath, command);
      } catch (_) {}
      throw new Error(msg);
    }

    return command;
  } else {
    throw new Error(`Unrecognized command ${JSON.stringify(options)}`);
  }
}

export function middleware_handleDiagnostics(
  params: PublishDiagnosticsParams,
  languageServerName: string,
  host: HostServices,
  showStatus: StatusData => Promise<?string>,
) {
  if (languageServerName === 'ocaml') {
    try {
      // $FlowFB
      const strings = require('./fb-strings');
      strings.ocamlDiagnostics(params, host, showStatus);
    } catch (_) {}
  }
}
