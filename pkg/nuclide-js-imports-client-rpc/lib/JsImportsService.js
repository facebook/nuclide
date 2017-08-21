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

import type {LogLevel} from '../../nuclide-logging/lib/rpc-types';

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {HostServices} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';

/* LanguageService related type imports */
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';

import {createMultiLspLanguageService} from '../../nuclide-vscode-language-service-rpc';

export async function initializeLsp(
  projectFileNames: Array<string>,
  fileExtensions: Array<NuclideUri>,
  logLevel: LogLevel,
  fileNotifier: FileNotifier,
  host: HostServices,
  initializationOptions: Object,
): Promise<LanguageService> {
  return createMultiLspLanguageService(
    'jsimports',
    // TODO(hansonw): Add a flag to properly fork the Node process.
    require.resolve('../../commons-node/fb-node-run.sh'),
    [
      require.resolve(
        '../../nuclide-js-imports-server/server/src/index-entry.js',
      ),
    ],
    {
      fileNotifier,
      host,
      logCategory: 'jsimports',
      logLevel,
      projectFileNames,
      fileExtensions,
      initializationOptions,
    },
  );
}
