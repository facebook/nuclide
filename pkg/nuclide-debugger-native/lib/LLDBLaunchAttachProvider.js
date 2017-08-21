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

import type {DebuggerActionUIProvider} from './actions/DebuggerActionUIProvider';
import type {DebuggerConfigAction} from '../../nuclide-debugger-base';

import {asyncFilter} from 'nuclide-commons/promise';
import {DebuggerLaunchAttachProvider} from '../../nuclide-debugger-base';
import {LaunchAttachStore} from './LaunchAttachStore';
import LaunchAttachDispatcher from './LaunchAttachDispatcher';
import {LaunchAttachActions} from './LaunchAttachActions';
import {NativeActionUIProvider} from './actions/NativeActionUIProvider';
import invariant from 'invariant';

export class LLDBLaunchAttachProvider extends DebuggerLaunchAttachProvider {
  _dispatcher: LaunchAttachDispatcher;
  _actions: LaunchAttachActions;
  _store: LaunchAttachStore;
  _uiProviderMap: Map<string, DebuggerActionUIProvider>;
  _enabledProviderNames: Map<string, Array<string>>;

  constructor(debuggingTypeName: string, targetUri: string) {
    super(debuggingTypeName, targetUri);
    this._dispatcher = new LaunchAttachDispatcher();
    this._actions = new LaunchAttachActions(
      this._dispatcher,
      this.getTargetUri(),
    );
    this._store = new LaunchAttachStore(this._dispatcher);

    this._uiProviderMap = new Map();
    this._enabledProviderNames = new Map();
    this._loadAction(new NativeActionUIProvider(targetUri));
    try {
      // $FlowFB
      const module = require('./actions/fb-omActionUIProvider');
      if (module != null) {
        this._loadAction(new module.omActionUIProvider(targetUri));
      }
    } catch (_) {}
  }

  _loadAction(actionProvider: ?DebuggerActionUIProvider): void {
    if (actionProvider != null) {
      this._uiProviderMap.set(actionProvider.getName(), actionProvider);
    }
  }

  getCallbacksForAction(action: DebuggerConfigAction) {
    return {
      /**
       * Whether this provider is enabled or not.
       */
      isEnabled: async () => {
        if (this._enabledProviderNames.get(action) == null) {
          this._enabledProviderNames.set(action, []);
        }

        const providers = await asyncFilter(
          Array.from(this._uiProviderMap.values()),
          provider => provider.isEnabled(action),
        );

        const list = this._enabledProviderNames.get(action);
        invariant(list != null);

        for (const provider of providers) {
          list.push(provider.getName());
        }

        return providers.length > 0;
      },

      /**
       * Returns a list of supported debugger types + environments for the specified action.
       */
      getDebuggerTypeNames: () => {
        return this._enabledProviderNames.get(action) || [];
      },

      /**
       * Returns the UI component for configuring the specified debugger type and action.
       */
      getComponent: (
        debuggerTypeName: string,
        configIsValidChanged: (valid: boolean) => void,
      ) => {
        const provider = this._uiProviderMap.get(debuggerTypeName);
        if (provider) {
          return provider.getComponent(
            this._store,
            this._actions,
            debuggerTypeName,
            action,
            configIsValidChanged,
          );
        }
        return null;
      },
    };
  }

  dispose(): void {
    this._store.dispose();
    this._actions.dispose();
  }
}
