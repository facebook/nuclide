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
import type {DebuggerConfigAction} from '../../nuclide-debugger-base';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {DebuggerLaunchAttachProvider} from '../../nuclide-debugger-base';
import {LaunchAttachStore} from './LaunchAttachStore';
import LaunchAttachDispatcher from './LaunchAttachDispatcher';
import {LaunchAttachActions} from './LaunchAttachActions';
import {NativeActionUIProvider} from './actions/NativeActionUIProvider';

function isNativeDebuggerEnabled(targetUri: NuclideUri): boolean {
  if (nuclideUri.isRemote(targetUri)) {
    return true;
  } else {
    // Local native debugger is not supported on Windows.
    return process.platform !== 'win32';
  }
}

export class LLDBLaunchAttachProvider extends DebuggerLaunchAttachProvider {
  _dispatcher: LaunchAttachDispatcher;
  _actions: LaunchAttachActions;
  _store: LaunchAttachStore;
  _actionProvider: NativeActionUIProvider;

  constructor(debuggingTypeName: string, targetUri: string) {
    super(debuggingTypeName, targetUri);
    this._dispatcher = new LaunchAttachDispatcher();
    this._actions = new LaunchAttachActions(
      this._dispatcher,
      this.getTargetUri(),
    );
    this._store = new LaunchAttachStore(this._dispatcher);
    this._actionProvider = new NativeActionUIProvider(targetUri);
  }

  getCallbacksForAction(action: DebuggerConfigAction) {
    return {
      /**
       * Whether this provider is enabled or not.
       */
      isEnabled: async () => {
        return isNativeDebuggerEnabled(this.getTargetUri());
      },

      /**
       * Returns a list of supported debugger types + environments for the specified action.
       */
      getDebuggerTypeNames: () => {
        return isNativeDebuggerEnabled(this.getTargetUri())
          ? [this._actionProvider.getName()]
          : [];
      },

      /**
       * Returns the UI component for configuring the specified debugger type and action.
       */
      getComponent: (
        debuggerTypeName: string,
        configIsValidChanged: (valid: boolean) => void,
      ) => {
        return this._actionProvider.getComponent(
          this._store,
          this._actions,
          debuggerTypeName,
          action,
          configIsValidChanged,
        );
      },
    };
  }

  dispose(): void {
    this._store.dispose();
    this._actions.dispose();
  }
}
