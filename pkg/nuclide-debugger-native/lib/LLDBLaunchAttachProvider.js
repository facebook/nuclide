'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {DebuggerActionUIProvider} from './actions/DebuggerActionUIProvider';
import type EventEmitter from 'events';

import {asyncFilter} from '../../commons-node/promise';
import {DebuggerLaunchAttachProvider} from '../../nuclide-debugger-base';
import {React} from 'react-for-atom';
import {LaunchAttachStore} from './LaunchAttachStore';
import LaunchAttachDispatcher from './LaunchAttachDispatcher';
import {LaunchAttachActions} from './LaunchAttachActions';
import * as LaunchActionUIProvider from './actions/LaunchActionUIProvider';
import * as AttachActionUIProvider from './actions/AttachActionUIProvider';


export class LLDBLaunchAttachProvider extends DebuggerLaunchAttachProvider {
  _dispatcher: LaunchAttachDispatcher;
  _actions: LaunchAttachActions;
  _store: LaunchAttachStore;
  _uiProviderMap: Map<string, DebuggerActionUIProvider>;

  constructor(debuggingTypeName: string, targetUri: string) {
    super(debuggingTypeName, targetUri);
    this._dispatcher = new LaunchAttachDispatcher();
    this._actions = new LaunchAttachActions(this._dispatcher, this.getTargetUri());
    this._store = new LaunchAttachStore(this._dispatcher);

    this._uiProviderMap = new Map();
    this._loadAction(AttachActionUIProvider);
    this._loadAction(LaunchActionUIProvider);
    try {
      // $FlowFB
      this._loadAction(require('./actions/fb-omActionUIProvider'));
    } catch (_) {}
  }

  _loadAction(actionProvider: ?DebuggerActionUIProvider): void {
    if (actionProvider != null) {
      this._uiProviderMap.set(actionProvider.name, actionProvider);
    }
  }

  async getActions(): Promise<Array<string>> {
    const providers = await asyncFilter(
      Array.from(this._uiProviderMap.values()),
      provider => provider.isEnabled(),
    );
    return providers.map(provider => provider.name);
  }

  getComponent(
    actionName: string,
    parentEventEmitter: EventEmitter): ?React.Element<any> {
    const action = this._uiProviderMap.get(actionName);
    if (action) {
      return action.getComponent(this._store, this._actions, parentEventEmitter);
    }
    return null;
  }

  dispose(): void {
    this._store.dispose();
    this._actions.dispose();
  }
}
