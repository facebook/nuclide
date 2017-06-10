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
import type {
  HostServices,
} from '../../nuclide-language-service-rpc/lib/rpc-types';

/* LanguageService related type imports */
import type {
  LanguageService,
} from '../../nuclide-language-service/lib/LanguageService';

import invariant from 'assert';

import {FileCache} from '../../nuclide-open-files-rpc';
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';
import {
  createMultiLspLanguageService,
} from '../../nuclide-vscode-language-service';

import {logger} from './config';

export async function initializeLsp(
  command: string,
  args: Array<string>,
  projectFileName: string,
  fileExtensions: Array<NuclideUri>,
  logLevel: LogLevel,
  fileNotifier: FileNotifier,
  host: HostServices,
): Promise<LanguageService> {
  invariant(fileNotifier instanceof FileCache);
  logger.setLevel(logLevel);
  return createMultiLspLanguageService(
    logger,
    fileNotifier,
    host,
    'GraphQL',
    command,
    args,
    projectFileName,
    fileExtensions,
  );
}
