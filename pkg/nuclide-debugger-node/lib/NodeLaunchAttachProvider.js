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

import type {DebuggerConfigAction} from '../../nuclide-debugger-base';

import {DebuggerLaunchAttachProvider} from '../../nuclide-debugger-base';
import React from 'react';
import LaunchAttachDispatcher from './LaunchAttachDispatcher';
import {LaunchAttachStore} from './LaunchAttachStore';
import {AttachUIComponent} from './AttachUIComponent';
import {LaunchAttachActions} from './LaunchAttachActions';

export class NodeLaunchAttachProvider extends DebuggerLaunchAttachProvider {
  _dispatcher: LaunchAttachDispatcher;
  _actions: LaunchAttachActions;
  _store: LaunchAttachStore;

  constructor(debuggingTypeName: string, targetUri: string) {
    super(debuggingTypeName, targetUri);
    this._dispatcher = new LaunchAttachDispatcher();
    this._actions = new LaunchAttachActions(
      this._dispatcher,
      this.getTargetUri(),
    );
    this._store = new LaunchAttachStore(this._dispatcher);
  }

  getCallbacksForAction(action: DebuggerConfigAction) {
    return {
      /**
       * Whether this provider is enabled or not.
       */
      isEnabled: () => {
        return Promise.resolve(action === 'attach');
      },

      /**
       * Returns a list of supported debugger types + environments for the specified action.
       */
      getDebuggerTypeNames: super.getCallbacksForAction(action)
        .getDebuggerTypeNames,

      /**
       * Returns the UI component for configuring the specified debugger type and action.
       */
      getComponent: (
        debuggerTypeName: string,
        configIsValidChanged: (valid: boolean) => void,
      ) => {
        if (action === 'attach') {
          this._actions.updateAttachTargetList();
          return (
            <AttachUIComponent
              targetUri={this._targetUri}
              store={this._store}
              actions={this._actions}
              configIsValidChanged={configIsValidChanged}
            />
          );
        } else {
          return null;
        }
      },
    };
  }

  dispose(): void {
    this._store.dispose();
    this._actions.dispose();
  }
}
