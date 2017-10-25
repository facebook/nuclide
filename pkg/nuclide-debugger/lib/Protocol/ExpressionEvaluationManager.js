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
  RemoteObjectId,
  PropertyDescriptor,
  Scope,
  CallFrameId,
  EvaluateOnCallFrameResponse,
  EvaluateResponse,
  GetPropertiesResponse,
} from '../../../nuclide-debugger-base/lib/protocol-types';
import type {ObjectGroup, ExpansionResult} from '../types';
import type DebuggerDomainDispatcher from './DebuggerDomainDispatcher';
import type RuntimeDomainDispatcher from './RuntimeDomainDispatcher';

import invariant from 'assert';
import {Subject, Observable} from 'rxjs';
import {reportError} from './EventReporter';

class RemoteObjectProxy {
  _objectId: RemoteObjectId;
  _runtimeDispatcher: RuntimeDomainDispatcher;

  constructor(
    runtimeDispatcher: RuntimeDomainDispatcher,
    objectId: RemoteObjectId,
  ) {
    this._runtimeDispatcher = runtimeDispatcher;
    this._objectId = objectId;
  }

  getProperties(): Promise<GetPropertiesResponse> {
    return new Promise((resolve, reject) => {
      function callback(error: Error, response: GetPropertiesResponse) {
        if (error != null) {
          reportError(`getProperties failed with ${JSON.stringify(error)}`);
          reject(error);
        }
        resolve(response);
      }
      this._runtimeDispatcher.getProperties(
        this._objectId,
        callback.bind(this),
      );
    });
  }
}

class RemoteObjectManager {
  _runtimeDispatcher: RuntimeDomainDispatcher;
  _remoteObjects: Map<RemoteObjectId, RemoteObjectProxy>;

  constructor(runtimeDispatcher: RuntimeDomainDispatcher) {
    this._runtimeDispatcher = runtimeDispatcher;
    this._remoteObjects = new Map();
  }

  addObject(objectId: RemoteObjectId): RemoteObjectProxy {
    const remoteObject = new RemoteObjectProxy(
      this._runtimeDispatcher,
      objectId,
    );
    this._remoteObjects.set(objectId, remoteObject);
    return remoteObject;
  }

  getRemoteObjectFromId(objectId: RemoteObjectId): ?RemoteObjectProxy {
    return this._remoteObjects.get(objectId);
  }

  clear(): void {
    this._remoteObjects.clear();
  }
}

/**
 * Bridge between Nuclide IPC and RPC breakpoint protocols.
 */
export default class ExpressionEvaluationManager {
  _debuggerDispatcher: DebuggerDomainDispatcher;
  _runtimeDispatcher: RuntimeDomainDispatcher;
  _evalutionEvent$: Subject<Array<mixed>>;
  _remoteObjectManager: RemoteObjectManager;

  constructor(
    debuggerDispatcher: DebuggerDomainDispatcher,
    runtimeDispatcher: RuntimeDomainDispatcher,
  ) {
    this._debuggerDispatcher = debuggerDispatcher;
    this._runtimeDispatcher = runtimeDispatcher;
    this._evalutionEvent$ = new Subject();
    this._remoteObjectManager = new RemoteObjectManager(runtimeDispatcher);
  }

  evaluateOnCallFrame(
    transactionId: number,
    callFrameId: CallFrameId,
    expression: string,
    objectGroup: ObjectGroup,
  ): void {
    function callback(error: Error, response: EvaluateOnCallFrameResponse) {
      if (error != null) {
        reportError(`evaluateOnCallFrame failed with ${JSON.stringify(error)}`);
        return;
      }
      const {result, wasThrown, exceptionDetails} = response;
      if (result != null && result.objectId != null) {
        this._remoteObjectManager.addObject(result.objectId);
      }
      this._raiseIPCEvent('ExpressionEvaluationResponse', {
        result,
        error: wasThrown ? exceptionDetails : null,
        expression,
        id: transactionId,
      });
    }
    this._debuggerDispatcher.evaluateOnCallFrame(
      callFrameId,
      expression,
      objectGroup,
      callback.bind(this),
    );
  }

  runtimeEvaluate(
    transactionId: number,
    expression: string,
    objectGroup: ObjectGroup,
  ): void {
    function callback(error: Error, response: EvaluateResponse) {
      if (error != null) {
        reportError(`runtimeEvaluate failed with ${JSON.stringify(error)}`);
        return;
      }
      const {result, wasThrown, exceptionDetails} = response;
      if (result.objectId != null) {
        this._remoteObjectManager.addObject(result.objectId);
      }
      this._raiseIPCEvent('ExpressionEvaluationResponse', {
        result,
        error: wasThrown ? exceptionDetails : null,
        expression,
        id: transactionId,
      });
    }
    this._runtimeDispatcher.evaluate(
      expression,
      objectGroup,
      callback.bind(this),
    );
  }

  getProperties(id: number, objectId: RemoteObjectId): void {
    const remoteObject = this._remoteObjectManager.getRemoteObjectFromId(
      objectId,
    );
    if (remoteObject == null) {
      reportError(`Cannot find object id ${objectId} for getProperties()`);
      return;
    }
    remoteObject.getProperties().then(response => {
      // TODO: exceptionDetails
      const {result} = response;
      const expansionResult = this._propertiesToExpansionResult(result);
      this._raiseIPCEvent('GetPropertiesResponse', {
        result: expansionResult,
        // error, TODO
        objectId,
        id,
      });
    });
  }

  _propertiesToExpansionResult(
    properties: Array<PropertyDescriptor>,
  ): ?ExpansionResult {
    return properties
      .filter(({name, value}) => value != null)
      .map(({name, value}) => {
        invariant(value != null);
        const {type, subtype, objectId, value: innerValue, description} = value;
        if (objectId != null) {
          this._remoteObjectManager.addObject(objectId);
        }
        return {
          name,
          value: {
            type,
            subtype,
            objectId,
            value: innerValue,
            description,
          },
        };
      });
  }

  updateCurrentFrameScope(scopes: Array<Scope>): void {
    const scopesPromises = scopes.map(async scope => {
      const scopeObjectId = scope.object.objectId;
      invariant(
        scopeObjectId != null,
        'Engine returns a scope without objectId?',
      );
      const remoteObject = this._remoteObjectManager.addObject(scopeObjectId);
      const response = await remoteObject.getProperties();

      // TODO: deal with response.exceptionDetails.
      const scopeVariables = this._propertiesToExpansionResult(response.result);
      return {
        name: scope.object.description,
        scopeVariables,
        scopeObjectId,
      };
    });

    Promise.all(scopesPromises).then(scopesData => {
      this._raiseIPCEvent('ScopesUpdate', scopesData);
    });
  }

  clearPauseStates(): void {
    this._remoteObjectManager.clear();
  }

  getEventObservable(): Observable<Array<mixed>> {
    return this._evalutionEvent$.asObservable();
  }

  // Not a real IPC event, but simulate the chrome IPC events/responses
  // across bridge boundary.
  _raiseIPCEvent(...args: Array<mixed>): void {
    this._evalutionEvent$.next(args);
  }
}
