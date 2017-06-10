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

import type {
  NuclideDebuggerProvider,
} from '../../nuclide-debugger-interfaces/service';
import type {DebuggerLaunchAttachProvider} from '../../nuclide-debugger-base';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import logger from './utils';
import {getConfig} from './utils';
import {LLDBLaunchAttachProvider} from './LLDBLaunchAttachProvider';

export function activate(state: mixed): void {
  logger.setLevel(getConfig().clientLogLevel);
}

export function createDebuggerProvider(): NuclideDebuggerProvider {
  return {
    name: 'lldb',
    getLaunchAttachProvider(
      connection: NuclideUri,
    ): ?DebuggerLaunchAttachProvider {
      return new LLDBLaunchAttachProvider('Native', connection);
    },
  };
}
