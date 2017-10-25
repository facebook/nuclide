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
  Location,
} from '../../../nuclide-debugger-base/lib/protocol-types';
import type {ThreadSwitchMessageData} from '../types';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {Subject, Observable} from 'rxjs';
import {reportError} from './EventReporter';

/**
 * Bridge between Nuclide IPC and RPC execution control protocols.
 */
export default class ExecutionManager {
  _debuggerDispatcher: DebuggerDomainDispatcher;
  _executionEvent$: Subject<Array<mixed>>;
  _getIsReadonlyTarget: () => boolean;

  constructor(
    debuggerDispatcher: DebuggerDomainDispatcher,
    getIsReadonlyTarget: () => boolean,
  ) {
    this._executionEvent$ = new Subject();
    this._debuggerDispatcher = debuggerDispatcher;
    this._getIsReadonlyTarget = getIsReadonlyTarget;
  }

  getEventObservable(): Observable<Array<mixed>> {
    return this._executionEvent$.asObservable();
  }

  resume(): void {
    if (!this._getIsReadonlyTarget()) {
      this._debuggerDispatcher.resume();
    }
  }

  pause(): void {
    if (!this._getIsReadonlyTarget()) {
      this._debuggerDispatcher.pause();
    }
  }

  stepOver(): void {
    if (!this._getIsReadonlyTarget()) {
      this._debuggerDispatcher.stepOver();
    }
  }

  stepInto(): void {
    if (!this._getIsReadonlyTarget()) {
      this._debuggerDispatcher.stepInto();
    }
  }

  stepOut(): void {
    if (!this._getIsReadonlyTarget()) {
      this._debuggerDispatcher.stepOut();
    }
  }

  runToLocation(fileUri: NuclideUri, line: number): void {
    if (!this._getIsReadonlyTarget()) {
      // Chrome's continueToLocation implementation incorrect
      // uses source uri instead of scriptId as the location ScriptId
      // field, we mirror the same behavior for compatibility reason.
      const sourceUri = this._debuggerDispatcher.getSourceUriFromUri(fileUri);
      if (sourceUri != null) {
        const scriptId = nuclideUri.getPath(sourceUri);
        this._debuggerDispatcher.continueToLocation({
          scriptId,
          lineNumber: line,
          columnNumber: 0,
        });
      } else {
        reportError(`Cannot find resolve location for file: ${fileUri}`);
      }
    }
  }

  continueFromLoaderBreakpoint(): boolean {
    if (!this._getIsReadonlyTarget()) {
      this._debuggerDispatcher.resume();
      this._raiseIPCEvent('LoaderBreakpointResumed');
      return true;
    }
    return false;
  }

  raiseDebuggerPause(
    params: PausedEvent,
    threadSwitchLocation: ?Location,
  ): void {
    const threadSwitchData = this._generateThreadSwitchNotification(
      params.threadSwitchMessage,
      threadSwitchLocation,
    );
    this._raiseIPCEvent('NonLoaderDebuggerPaused', {
      stopThreadId: params.stopThreadId,
      threadSwitchNotification: threadSwitchData,
    });
  }

  _generateThreadSwitchNotification(
    message: ?string,
    location: ?Location,
  ): ?ThreadSwitchMessageData {
    if (message != null && location != null) {
      const {scriptId, lineNumber} = location;
      const sourceURL = this._debuggerDispatcher.getFileUriFromScriptId(
        scriptId,
      );
      return {
        sourceURL,
        lineNumber,
        message,
      };
    } else {
      return null;
    }
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
