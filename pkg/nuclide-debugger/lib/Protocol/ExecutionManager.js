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
import type DebuggerDomainDispatcher from './DebuggerDomainDispatcher';
import type {
  PausedEvent,
} from '../../../nuclide-debugger-base/lib/protocol-types';

import {Subject, Observable} from 'rxjs';
import {reportError} from './EventReporter';

/**
 * Bridge between Nuclide IPC and RPC execution control protocols.
 */
export default class ExecutionManager {
  _debuggerDispatcher: DebuggerDomainDispatcher;
  _executionEvent$: Subject<Array<mixed>>;

  constructor(debuggerDispatcher: DebuggerDomainDispatcher) {
    this._executionEvent$ = new Subject();
    this._debuggerDispatcher = debuggerDispatcher;
  }

  getEventObservable(): Observable<Array<mixed>> {
    return this._executionEvent$.asObservable();
  }

  resume(): void {
    this._debuggerDispatcher.resume();
  }

  pause(): void {
    this._debuggerDispatcher.pause();
  }

  stepOver(): void {
    this._debuggerDispatcher.stepOver();
  }

  stepInto(): void {
    this._debuggerDispatcher.stepInto();
  }

  stepOut(): void {
    this._debuggerDispatcher.stepOut();
  }

  runToLocation(fileUri: NuclideUri, line: number): void {
    // Chrome's continueToLocation implementation incorrect
    // uses source uri instead of scriptId as the location ScriptId
    // field, we mirrow the same behavior for compatibility reason.
    const scriptId = this._debuggerDispatcher.getSourceUriFromUri(fileUri);
    if (scriptId != null) {
      this._debuggerDispatcher.continueToLocation({
        scriptId,
        lineNumber: line,
        columnNumber: 0,
      });
    } else {
      reportError(`Cannot find resolve location for file: ${fileUri}`);
    }
  }

  continueFromLoaderBreakpoint(): void {
    this._debuggerDispatcher.resume();
    this._raiseIPCEvent('LoaderBreakpointResumed');
  }

  handleDebuggerPaused(params: PausedEvent): void {
    this._raiseIPCEvent('NonLoaderDebuggerPaused', {
      stopThreadId: params.stopThreadId,
      threadSwitchNotification: null, // TODO
    });
  }

  handleDebuggeeResumed(): void {
    this._raiseIPCEvent('DebuggerResumed');
  }

  // Not a real IPC event, but simulate the chrome IPC events/responses
  // across bridge boundary.
  _raiseIPCEvent(...args: Array<mixed>): void {
    this._executionEvent$.next(args);
  }
}
