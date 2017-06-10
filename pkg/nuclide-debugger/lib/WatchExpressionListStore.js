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
  Expression,
  EvaluatedExpression,
  EvaluatedExpressionList,
} from './types';
import type {WatchExpressionStore} from './WatchExpressionStore';
import type DebuggerDispatcher, {DebuggerAction} from './DebuggerDispatcher';
import type {Observable} from 'rxjs';

import {Disposable, CompositeDisposable} from 'atom';
import {BehaviorSubject} from 'rxjs';
import {ActionTypes} from './DebuggerDispatcher';
import {DebuggerMode} from './DebuggerStore';

export class WatchExpressionListStore {
  _watchExpressionStore: WatchExpressionStore;
  _disposables: IDisposable;
  /**
   * Treat the underlying EvaluatedExpressionList as immutable.
   */
  _watchExpressions: BehaviorSubject<EvaluatedExpressionList>;

  constructor(
    watchExpressionStore: WatchExpressionStore,
    dispatcher: DebuggerDispatcher,
  ) {
    this._watchExpressionStore = watchExpressionStore;
    const dispatcherToken = dispatcher.register(this._handlePayload.bind(this));
    this._disposables = new CompositeDisposable(
      new Disposable(() => {
        dispatcher.unregister(dispatcherToken);
      }),
    );
    this._watchExpressions = new BehaviorSubject([]);
  }

  _handlePayload(payload: DebuggerAction) {
    switch (payload.actionType) {
      case ActionTypes.ADD_WATCH_EXPRESSION:
        this._addWatchExpression(payload.data.expression);
        break;
      case ActionTypes.REMOVE_WATCH_EXPRESSION:
        this._removeWatchExpression(payload.data.index);
        break;
      case ActionTypes.UPDATE_WATCH_EXPRESSION:
        this._updateWatchExpression(
          payload.data.index,
          payload.data.newExpression,
        );
        break;
      case ActionTypes.DEBUGGER_MODE_CHANGE:
        if (payload.data === DebuggerMode.STARTING) {
          this._refetchWatchSubscriptions();
        }
        break;
      default:
        return;
    }
  }

  _getExpressionEvaluationFor(expression: Expression): EvaluatedExpression {
    return {
      expression,
      value: this._watchExpressionStore.evaluateWatchExpression(expression),
    };
  }

  getWatchExpressions(): Observable<EvaluatedExpressionList> {
    return this._watchExpressions.asObservable();
  }

  _addWatchExpression(expression: Expression): void {
    this._watchExpressions.next([
      ...this._watchExpressions.getValue(),
      this._getExpressionEvaluationFor(expression),
    ]);
  }

  _removeWatchExpression(index: number): void {
    const watchExpressions = this._watchExpressions.getValue().slice();
    watchExpressions.splice(index, 1);
    this._watchExpressions.next(watchExpressions);
  }

  _updateWatchExpression(index: number, newExpression: Expression): void {
    const watchExpressions = this._watchExpressions.getValue().slice();
    watchExpressions[index] = this._getExpressionEvaluationFor(newExpression);
    this._watchExpressions.next(watchExpressions);
  }

  _refetchWatchSubscriptions(): void {
    const watchExpressions = this._watchExpressions.getValue().slice();
    const refetchedWatchExpressions = watchExpressions.map(({expression}) => {
      return this._getExpressionEvaluationFor(expression);
    });
    this._watchExpressions.next(refetchedWatchExpressions);
  }

  dispose(): void {
    this._disposables.dispose();
  }
}
