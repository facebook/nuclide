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

import type Bridge from './Bridge';
import type {
  ChromeProtocolResponse,
  EvalCommand,
  EvaluationResult,
  ExpansionResult,
  ObjectGroup,
} from './types';
import type DebuggerDispatcher, {DebuggerAction} from './DebuggerDispatcher';

import {DebuggerMode} from './DebuggerStore';
import {ActionTypes} from './DebuggerDispatcher';
import {BehaviorSubject, Observable} from 'rxjs';
import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Deferred} from 'nuclide-commons/promise';
import {getLogger} from 'log4js';
import {normalizeRemoteObjectValue} from './normalizeRemoteObjectValue';

type Expression = string;

export class WatchExpressionStore {
  _bridge: Bridge;
  _disposables: UniversalDisposable;
  _watchExpressions: Map<Expression, BehaviorSubject<?EvaluationResult>>;
  _previousEvaluationSubscriptions: UniversalDisposable;
  _evaluationId: number;
  _isPaused: boolean;
  _evaluationRequestsInFlight: Map<number, Deferred<mixed>>;

  constructor(dispatcher: DebuggerDispatcher, bridge: Bridge) {
    this._evaluationId = 0;
    this._isPaused = false;
    this._bridge = bridge;
    this._disposables = new UniversalDisposable();
    this._watchExpressions = new Map();
    this._evaluationRequestsInFlight = new Map();
    this._disposables.add(() => this._watchExpressions.clear());
    // `this._previousEvaluationSubscriptions` can change at any time and are a distinct subset of
    // `this._disposables`.
    this._previousEvaluationSubscriptions = new UniversalDisposable();
    this._disposables.add(this._previousEvaluationSubscriptions);
    const _dispatcherToken = dispatcher.register(
      this._handlePayload.bind(this),
    );
    this._disposables.add(() => {
      dispatcher.unregister(_dispatcherToken);
    });
  }

  _handlePayload(payload: DebuggerAction) {
    switch (payload.actionType) {
      case ActionTypes.CLEAR_INTERFACE: {
        this._clearEvaluationValues();
        break;
      }
      case ActionTypes.DEBUGGER_MODE_CHANGE: {
        this._isPaused = false;
        if (payload.data === DebuggerMode.PAUSED) {
          this._isPaused = true;
          this._triggerReevaluation();
        } else if (payload.data === DebuggerMode.STOPPED) {
          this._cancelRequestsToBridge();
          this._clearEvaluationValues();
        }
        break;
      }
      case ActionTypes.RECEIVED_GET_PROPERTIES_RESPONSE: {
        const {id, response} = payload.data;
        this._handleResponseForPendingRequest(id, response);
        break;
      }
      case ActionTypes.RECEIVED_EXPRESSION_EVALUATION_RESPONSE: {
        const {id, response} = payload.data;
        response.result = normalizeRemoteObjectValue(response.result);
        this._handleResponseForPendingRequest(id, response);
        break;
      }
      default: {
        return;
      }
    }
  }

  _triggerReevaluation(): void {
    this._cancelRequestsToBridge();
    for (const [expression, subject] of this._watchExpressions) {
      if (subject.observers == null || subject.observers.length === 0) {
        // Nobody is watching this expression anymore.
        this._watchExpressions.delete(expression);
        continue;
      }
      this._requestExpressionEvaluation(
        expression,
        subject,
        false /* no REPL support */,
      );
    }
  }

  _cancelRequestsToBridge(): void {
    this._previousEvaluationSubscriptions.dispose();
    this._previousEvaluationSubscriptions = new UniversalDisposable();
  }

  // Resets all values to N/A, for examples when the debugger resumes or stops.
  _clearEvaluationValues(): void {
    for (const subject of this._watchExpressions.values()) {
      subject.next(null);
    }
  }

  /**
   * Returns an observable of child properties for the given objectId.
   * Resources are automatically cleaned up once all subscribers of an expression have unsubscribed.
   */
  getProperties(objectId: string): Observable<?ExpansionResult> {
    const getPropertiesPromise: Promise<?ExpansionResult> = this._sendEvaluationCommand(
      'getProperties',
      objectId,
    );
    return Observable.fromPromise(getPropertiesPromise);
  }

  evaluateConsoleExpression(
    expression: Expression,
  ): Observable<?EvaluationResult> {
    return this._evaluateExpression(expression, true /* support REPL */);
  }

  evaluateWatchExpression(
    expression: Expression,
  ): Observable<?EvaluationResult> {
    return this._evaluateExpression(
      expression,
      false /* do not support REPL */,
    );
  }

  /**
   * Returns an observable of evaluation results for a given expression.
   * Resources are automatically cleaned up once all subscribers of an expression have unsubscribed.
   *
   * The supportRepl boolean indicates if we allow evaluation in a non-paused state.
   */
  _evaluateExpression(
    expression: Expression,
    supportRepl: boolean,
  ): Observable<?EvaluationResult> {
    if (!supportRepl && this._watchExpressions.has(expression)) {
      const cachedResult = this._watchExpressions.get(expression);
      invariant(cachedResult);
      return cachedResult;
    }
    const subject = new BehaviorSubject();
    this._requestExpressionEvaluation(expression, subject, supportRepl);
    if (!supportRepl) {
      this._watchExpressions.set(expression, subject);
    }
    // Expose an observable rather than the raw subject.
    return subject.asObservable();
  }

  _requestExpressionEvaluation(
    expression: Expression,
    subject: BehaviorSubject<?EvaluationResult>,
    supportRepl: boolean,
  ): void {
    let evaluationPromise;
    if (supportRepl) {
      evaluationPromise = this._isPaused
        ? this._evaluateOnSelectedCallFrame(expression, 'console')
        : this._runtimeEvaluate(expression);
    } else {
      evaluationPromise = this._evaluateOnSelectedCallFrame(
        expression,
        'watch-group',
      );
    }

    const evaluationDisposable = new UniversalDisposable(
      Observable.fromPromise(evaluationPromise)
        .merge(Observable.never()) // So that we do not unsubscribe `subject` when disposed.
        .subscribe(subject),
    );

    // Non-REPL environments will want to record these requests so they can be canceled on
    // re-evaluation, e.g. in the case of stepping.  REPL environments should let them complete so
    // we can have e.g. a history of evaluations in the console.
    if (!supportRepl) {
      this._previousEvaluationSubscriptions.add(evaluationDisposable);
    } else {
      this._disposables.add(evaluationDisposable);
    }
  }

  async _evaluateOnSelectedCallFrame(
    expression: string,
    objectGroup: ObjectGroup,
  ): Promise<?EvaluationResult> {
    try {
      const result: ?EvaluationResult = await this._sendEvaluationCommand(
        'evaluateOnSelectedCallFrame',
        expression,
        objectGroup,
      );
      if (result == null) {
        // Backend returned neither a result nor an error message
        return {
          type: 'text',
          value: `Failed to evaluate: ${expression}`,
        };
      } else {
        return result;
      }
    } catch (e) {
      return {
        type: 'text',
        value: `Failed to evaluate: ${expression} ` + e.toString(),
      };
    }
  }

  async _runtimeEvaluate(expression: string): Promise<?EvaluationResult> {
    try {
      const result: ?EvaluationResult = await this._sendEvaluationCommand(
        'runtimeEvaluate',
        expression,
      );
      if (result == null) {
        // Backend returned neither a result nor an error message
        return {
          type: 'text',
          value: `Failed to evaluate: ${expression}`,
        };
      } else {
        return result;
      }
    } catch (e) {
      return {
        type: 'text',
        value: `Failed to evaluate: ${expression} ` + e.toString(),
      };
    }
  }

  async _sendEvaluationCommand(
    command: EvalCommand,
    ...args: Array<mixed>
  ): Promise<any> {
    const deferred = new Deferred();
    const evalId = this._evaluationId;
    ++this._evaluationId;
    this._evaluationRequestsInFlight.set(evalId, deferred);
    this._bridge.sendEvaluationCommand(command, evalId, ...args);
    let result = null;
    let errorMsg = null;
    try {
      result = await deferred.promise;
    } catch (e) {
      getLogger('nuclide-debugger').warn(
        `${command}: Error getting result.`,
        e,
      );
      if (e.description) {
        errorMsg = e.description;
      }
    }
    this._evaluationRequestsInFlight.delete(evalId);
    if (errorMsg != null) {
      throw new Error(errorMsg);
    }
    return result;
  }

  _handleResponseForPendingRequest(
    id: number,
    response: ChromeProtocolResponse,
  ): void {
    const {result, error} = response;
    const deferred = this._evaluationRequestsInFlight.get(id);
    if (deferred == null) {
      // Nobody is listening for the result of this expression.
      return;
    }
    if (error != null) {
      deferred.reject(error);
    } else {
      deferred.resolve(result);
    }
  }

  dispose(): void {
    this._disposables.dispose();
  }
}
