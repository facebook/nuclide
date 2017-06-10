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

import type DebuggerDispatcher, {DebuggerAction} from './DebuggerDispatcher';
import type {ScopeSection} from './types';

import {Disposable, CompositeDisposable} from 'atom';
import {BehaviorSubject, Observable} from 'rxjs';
import {ActionTypes} from './DebuggerDispatcher';

export default class ScopesStore {
  _disposables: IDisposable;
  /**
   * Treat as immutable.
   */
  _scopes: BehaviorSubject<Array<ScopeSection>>;

  constructor(dispatcher: DebuggerDispatcher) {
    const dispatcherToken = dispatcher.register(this._handlePayload.bind(this));
    this._disposables = new CompositeDisposable(
      new Disposable(() => {
        dispatcher.unregister(dispatcherToken);
      }),
    );
    this._scopes = new BehaviorSubject([]);
  }

  _handlePayload(payload: DebuggerAction): void {
    switch (payload.actionType) {
      case ActionTypes.CLEAR_INTERFACE:
      case ActionTypes.SET_SELECTED_CALLFRAME_INDEX:
        this._handleClearInterface();
        break;
      case ActionTypes.UPDATE_SCOPES:
        this._handleUpdateScopes(payload.data);
        break;
      default:
        return;
    }
  }

  _handleClearInterface(): void {
    this._scopes.next([]);
  }

  _handleUpdateScopes(scopeSections: Array<ScopeSection>): void {
    this._scopes.next(scopeSections);
  }

  getScopes(): Observable<Array<ScopeSection>> {
    return this._scopes.asObservable();
  }

  dispose(): void {
    this._disposables.dispose();
  }
}
