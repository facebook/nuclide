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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {LogLevel} from '../../nuclide-logging/lib/rpc-types';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';
import type {HostServices} from '../../nuclide-language-service-rpc/lib/rpc-types';
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';

import {createMultiLspLanguageService} from '../../nuclide-vscode-language-service-rpc';
import {HACK_LOGGER_CATEGORY, DEFAULT_HACK_COMMAND} from './hack-config';

export async function initializeLsp(
  command: string,
  args: Array<string>,
  projectFileNames: Array<string>,
  fileExtensions: Array<NuclideUri>,
  logLevel: LogLevel,
  fileNotifier: FileNotifier,
  host: HostServices,
  initializationOptions: Object,
): Promise<?LanguageService> {
  const cmd = command === '' ? await DEFAULT_HACK_COMMAND : command;
  if (cmd === '') {
    return null;
  }

  return createMultiLspLanguageService('hack', cmd, args, {
    logCategory: HACK_LOGGER_CATEGORY,
    logLevel,
    fileNotifier,
    host,
    initializationOptions,
    projectFileNames,
    fileExtensions,
    additionalLogFilesRetentionPeriod: 5 * 60 * 1000, // 5 minutes
  });
}
