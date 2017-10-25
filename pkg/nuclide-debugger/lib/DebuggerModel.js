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

import {DebuggerProviderStore} from './DebuggerProviderStore';
import BreakpointManager from './BreakpointManager';
import BreakpointStore from './BreakpointStore';
import DebuggerActions from './DebuggerActions';
import {DebuggerStore} from './DebuggerStore';
import {WatchExpressionStore} from './WatchExpressionStore';
import CallstackStore from './CallstackStore';
import ScopesStore from './ScopesStore';
import ThreadStore from './ThreadStore';
import {WatchExpressionListStore} from './WatchExpressionListStore';
import DebuggerActionsStore from './DebuggerActionsStore';
import Bridge from './Bridge';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import DebuggerDispatcher from './DebuggerDispatcher';
import {DebuggerPauseController} from './DebuggerPauseController';
import EventEmitter from 'events';

import type {SerializedState} from '..';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/debugger';

/**
 * Atom ViewProvider compatible model object.
 */
export default class DebuggerModel {
  _disposables: UniversalDisposable;
  _actions: DebuggerActions;
  _breakpointManager: BreakpointManager;
  _breakpointStore: BreakpointStore;
  _dispatcher: DebuggerDispatcher;
  _emitter: EventEmitter;
  _store: DebuggerStore;
  _watchExpressionStore: WatchExpressionStore;
  _watchExpressionListStore: WatchExpressionListStore;
  _debuggerProviderStore: DebuggerProviderStore;
  _debuggerActionStore: DebuggerActionsStore;
  _callstackStore: CallstackStore;
  _scopesStore: ScopesStore;
  _threadStore: ThreadStore;
  _bridge: Bridge;
  _debuggerPauseController: DebuggerPauseController;

  constructor(state: ?SerializedState) {
    this._dispatcher = new DebuggerDispatcher();
    this._emitter = new EventEmitter();
    this._store = new DebuggerStore(this._dispatcher, this);
    this._actions = new DebuggerActions(this._dispatcher, this._store);
    this._breakpointStore = new BreakpointStore(
      this._dispatcher,
      state != null ? state.breakpoints : null, // serialized breakpoints
      this._store,
    );
    this._breakpointManager = new BreakpointManager(
      this._breakpointStore,
      this._actions,
    );
    this._bridge = new Bridge(this);
    this._debuggerProviderStore = new DebuggerProviderStore(
      this._dispatcher,
      this._actions,
    );
    this._watchExpressionStore = new WatchExpressionStore(
      this._dispatcher,
      this._bridge,
    );
    this._watchExpressionListStore = new WatchExpressionListStore(
      this._watchExpressionStore,
      this._dispatcher,
      state != null ? state.watchExpressions : null, // serialized watch expressions
    );
    this._debuggerActionStore = new DebuggerActionsStore(
      this._dispatcher,
      this._bridge,
    );
    this._callstackStore = new CallstackStore(this._dispatcher, this._store);
    this._scopesStore = new ScopesStore(
      this._dispatcher,
      this._bridge,
      this._store,
    );
    this._threadStore = new ThreadStore(this._dispatcher);
    this._debuggerPauseController = new DebuggerPauseController(this._store);

    this._disposables = new UniversalDisposable(
      this._store,
      this._actions,
      this._breakpointStore,
      this._breakpointManager,
      this._bridge,
      this._debuggerProviderStore,
      this._watchExpressionStore,
      this._debuggerActionStore,
      this._callstackStore,
      this._scopesStore,
      this._threadStore,
      this._debuggerPauseController,
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  getLaunchAttachActionEventEmitter(): EventEmitter {
    return this._emitter;
  }

  getActions(): DebuggerActions {
    return this._actions;
  }

  getStore(): DebuggerStore {
    return this._store;
  }

  getWatchExpressionStore(): WatchExpressionStore {
    return this._watchExpressionStore;
  }

  getWatchExpressionListStore(): WatchExpressionListStore {
    return this._watchExpressionListStore;
  }

  getDebuggerProviderStore(): DebuggerProviderStore {
    return this._debuggerProviderStore;
  }

  getBreakpointStore(): BreakpointStore {
    return this._breakpointStore;
  }

  getCallstackStore(): CallstackStore {
    return this._callstackStore;
  }

  getScopesStore(): ScopesStore {
    return this._scopesStore;
  }

  getThreadStore(): ThreadStore {
    return this._threadStore;
  }

  getBridge(): Bridge {
    return this._bridge;
  }

  getTitle(): string {
    return 'Debugger';
  }

  getDefaultLocation(): string {
    return 'right';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getPreferredWidth(): number {
    return 500;
  }
}
