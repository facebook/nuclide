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

import type {CallFrame} from '../../../nuclide-debugger-base/lib/protocol-types';
import type {Callstack} from '../types';
import type DebuggerDomainDispatcher from './DebuggerDomainDispatcher';

import invariant from 'assert';
import {Subject, Observable} from 'rxjs';

/**
 * Bridge between Nuclide IPC and RPC stack trace protocols.
 */
export default class StackTraceManager {
  _debuggerDispatcher: DebuggerDomainDispatcher;
  _stackTraceEvent$: Subject<Array<mixed>>;
  _currentCallFrameIndex: number;
  _currentThreadFrames: Array<CallFrame>;

  constructor(debuggerDispatcher: DebuggerDomainDispatcher) {
    this._stackTraceEvent$ = new Subject();
    this._currentCallFrameIndex = 0;
    this._currentThreadFrames = [];
    this._debuggerDispatcher = debuggerDispatcher;
  }

  getEventObservable(): Observable<Array<mixed>> {
    return this._stackTraceEvent$.asObservable();
  }

  setSelectedCallFrameIndex(index: number): void {
    if (this.isEmpty()) {
      return;
    }
    invariant(index >= 0 && index < this._currentThreadFrames.length);
    this._currentCallFrameIndex = index;
    const currentFrame = this.getCurrentFrame();
    invariant(currentFrame != null);
    this._raiseIPCEvent('CallFrameSelected', {
      sourceURL: this._debuggerDispatcher.getFileUriFromScriptId(
        currentFrame.location.scriptId,
      ),
      lineNumber: currentFrame.location.lineNumber,
    });
  }

  isEmpty(): boolean {
    return this._currentThreadFrames.length === 0;
  }

  getCurrentFrame(): ?CallFrame {
    if (this.isEmpty()) {
      return null;
    }
    invariant(this._currentCallFrameIndex < this._currentThreadFrames.length);
    return this._currentThreadFrames[this._currentCallFrameIndex];
  }

  /**
   * Refresh with new list of stack frames.
   * Like, user switches to a new thread.
   */
  refreshStack(stackFrames: Array<CallFrame>): void {
    this._currentThreadFrames = stackFrames;
    const callstack = this._parseCallstack();
    this._raiseIPCEvent('CallstackUpdate', callstack);
    this._selectFirstFrameWithSource();
  }

  _selectFirstFrameWithSource(): void {
    const frameWithSourceIndex = this._currentThreadFrames.findIndex(
      frame => frame.hasSource !== false, // undefined or true.
    );
    // Default to first frame if can't find any frame with source.
    this.setSelectedCallFrameIndex(
      frameWithSourceIndex !== -1 ? frameWithSourceIndex : 0,
    );
  }

  _parseCallstack(): Callstack {
    return this._currentThreadFrames.map(frame => {
      return {
        name: frame.functionName, // TODO: format
        location: {
          path: this._debuggerDispatcher.getFileUriFromScriptId(
            frame.location.scriptId,
          ),
          line: frame.location.lineNumber,
          column: frame.location.columnNumber,
          hasSource: frame.hasSource,
        },
      };
    });
  }

  clearPauseStates(): void {
    this._currentCallFrameIndex = 0;
    this._currentThreadFrames = [];
  }

  // Not a real IPC event, but simulate the chrome IPC events/responses
  // across bridge boundary.
  _raiseIPCEvent(...args: Array<mixed>): void {
    this._stackTraceEvent$.next(args);
  }
}
