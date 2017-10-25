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
import type {DebuggerConfigAction} from '../../../nuclide-debugger-base';

import * as React from 'react';
import {LaunchAttachActions} from '../LaunchAttachActions';
import {LaunchAttachStore} from '../LaunchAttachStore';

export class DebuggerActionUIProvider {
  _targetUri: NuclideUri;
  _name: string;

  constructor(name: string, targetUri: NuclideUri) {
    this._name = name;
    this._targetUri = targetUri;
  }

  getComponent(
    store: LaunchAttachStore,
    actions: LaunchAttachActions,
    debuggerTypeName: string,
    action: DebuggerConfigAction,
    configIsValidChanged: (valid: boolean) => void,
  ): React.Element<any> {
    throw new Error('Abstract method.');
  }

  getName(): string {
    return this._name;
  }

  isEnabled(action: DebuggerConfigAction): Promise<boolean> {
    throw new Error('Abstract method.');
  }
}
