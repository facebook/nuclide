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

import type {DebuggerConfigAction} from '../../../nuclide-debugger-base';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import * as React from 'react';
import {AttachUIComponent} from '../AttachUIComponent';
import {LaunchAttachActions} from '../LaunchAttachActions';
import {LaunchAttachStore} from '../LaunchAttachStore';
import {LaunchUIComponent} from '../LaunchUIComponent';
import {DebuggerActionUIProvider} from './DebuggerActionUIProvider';
import invariant from 'assert';

export class NativeActionUIProvider extends DebuggerActionUIProvider {
  constructor(targetUri: NuclideUri) {
    super('Native', targetUri);
  }

  getComponent(
    store: LaunchAttachStore,
    actions: LaunchAttachActions,
    debuggerTypeName: string,
    action: DebuggerConfigAction,
    configIsValidChanged: (valid: boolean) => void,
  ): React.Element<any> {
    actions.updateAttachTargetList();
    if (action === 'attach') {
      return (
        <AttachUIComponent
          store={store}
          actions={actions}
          configIsValidChanged={configIsValidChanged}
          targetUri={this._targetUri}
        />
      );
    } else {
      invariant(action === 'launch');
      return (
        <LaunchUIComponent
          store={store}
          actions={actions}
          configIsValidChanged={configIsValidChanged}
          targetUri={this._targetUri}
        />
      );
    }
  }
}
