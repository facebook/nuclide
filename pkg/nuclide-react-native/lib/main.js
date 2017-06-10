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

import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';
import type {OutputService} from '../../nuclide-console/lib/types';
import type {DebuggerLaunchAttachProvider} from '../../nuclide-debugger-base';
import type {
  NuclideDebuggerProvider,
} from '../../nuclide-debugger-interfaces/service';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {
  ReactNativeLaunchAttachProvider,
} from './debugging/ReactNativeLaunchAttachProvider';
import invariant from 'assert';
import Activation from './Activation';

let activation: ?Activation = null;

export function activate(state: ?Object): void {
  invariant(activation == null);
  activation = new Activation(state);
}

export function deactivate(): void {
  invariant(activation != null);
  activation.dispose();
  activation = null;
}

export function createDebuggerProvider(): NuclideDebuggerProvider {
  return {
    name: 'react-native',
    getLaunchAttachProvider(
      connection: NuclideUri,
    ): ?DebuggerLaunchAttachProvider {
      if (nuclideUri.isLocal(connection)) {
        return new ReactNativeLaunchAttachProvider('React Native', connection);
      }
      return null;
    },
  };
}

export function consumeOutputService(api: OutputService): void {
  invariant(activation != null);
  return activation.consumeOutputService(api);
}

export function consumeCwdApi(api: CwdApi): void {
  invariant(activation != null);
  return activation.consumeCwdApi(api);
}
