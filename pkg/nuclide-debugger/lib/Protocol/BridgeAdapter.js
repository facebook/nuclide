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

import type {Observable} from 'rxjs';
import type {IPCEvent, IPCBreakpoint, ObjectGroup} from '../types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ProtocolDebugEvent} from './DebuggerDomainDispatcher';
import type {
  BreakpointHitCountEvent,
  BreakpointResolvedEvent,
  PausedEvent,
  ThreadsUpdatedEvent,
  ThreadUpdatedEvent,
} from '../../../nuclide-debugger-base/lib/protocol-types';
import type DebuggerDomainDispatcher from './DebuggerDomainDispatcher';
import type RuntimeDomainDispatcher from './RuntimeDomainDispatcher';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import BreakpointManager from './BreakpointManager';
import StackTraceManager from './StackTraceManager';
import ExecutionManager from './ExecutionManager';
import ThreadManager from './ThreadManager';
import ExpressionEvaluationManager from './ExpressionEvaluationManager';
import DebuggerSettingsManager from './DebuggerSettingsManager';
import * as EventReporter from './EventReporter';

export default class BridgeAdapter {
  _subscriptions: UniversalDisposable;
  _breakpointManager: BreakpointManager;
  _stackTraceManager: StackTraceManager;
  _executionManager: ExecutionManager;
  _threadManager: ThreadManager;
  _expressionEvaluationManager: ExpressionEvaluationManager;
  _debuggerSettingsManager: DebuggerSettingsManager;
  _debuggerDispatcher: DebuggerDomainDispatcher;
  _runtimeDispatcher: RuntimeDomainDispatcher;
  _engineCreated: boolean;
  _pausedMode: boolean;
  _getIsReadonlyTarget: () => boolean;
  _shouldFilterBreak: (pausedEvent: PausedEvent) => boolean;

  constructor(
    dispatchers: Object,
    getIsReadonlyTarget: () => boolean,
    shouldFilterBreak: (pausedEvent: PausedEvent) => boolean,
  ) {
    const {debuggerDispatcher, runtimeDispatcher} = dispatchers;
    this._debuggerDispatcher = debuggerDispatcher;
    this._runtimeDispatcher = runtimeDispatcher;
    this._engineCreated = false;
    this._pausedMode = false;
    this._breakpointManager = new BreakpointManager(debuggerDispatcher);
    this._stackTraceManager = new StackTraceManager(debuggerDispatcher);
    this._executionManager = new ExecutionManager(
      debuggerDispatcher,
      getIsReadonlyTarget,
    );
    this._threadManager = new ThreadManager(debuggerDispatcher);
    this._debuggerSettingsManager = new DebuggerSettingsManager(
      debuggerDispatcher,
    );
    this._expressionEvaluationManager = new ExpressionEvaluationManager(
      debuggerDispatcher,
      runtimeDispatcher,
    );
    this._subscriptions = new UniversalDisposable(
      debuggerDispatcher.getEventObservable().subscribe(this._handleDebugEvent),
    );
    this._getIsReadonlyTarget = getIsReadonlyTarget;
    this._shouldFilterBreak = shouldFilterBreak;
  }

  enable(): void {
    this._debuggerDispatcher.enable();
    this._runtimeDispatcher.enable();
  }

  resume(): void {
    if (!this._getIsReadonlyTarget()) {
      this._clearStates();
      this._executionManager.resume();
    }
  }

  pause(): void {
    if (!this._getIsReadonlyTarget()) {
      this._clearStates();
      this._executionManager.pause();
    }
  }

  stepOver(): void {
    if (!this._getIsReadonlyTarget()) {
      this._clearStates();
      this._executionManager.stepOver();
    }
  }

  stepInto(): void {
    if (!this._getIsReadonlyTarget()) {
      this._clearStates();
      this._executionManager.stepInto();
    }
  }

  stepOut(): void {
    if (!this._getIsReadonlyTarget()) {
      this._clearStates();
      this._executionManager.stepOut();
    }
  }

  _clearStates(): void {
    this._pausedMode = false;
    this._expressionEvaluationManager.clearPauseStates();
    this._stackTraceManager.clearPauseStates();
  }

  runToLocation(fileUri: NuclideUri, line: number): void {
    if (!this._getIsReadonlyTarget()) {
      this._clearStates();
      this._executionManager.runToLocation(fileUri, line);
    }
  }

  setSelectedCallFrameIndex(index: number): void {
    this._stackTraceManager.setSelectedCallFrameIndex(index);
    this._updateCurrentScopes();
  }

  _updateCurrentScopes(): void {
    const currentFrame = this._stackTraceManager.getCurrentFrame();
    if (currentFrame != null) {
      this._expressionEvaluationManager.updateCurrentFrameScope(
        currentFrame.scopeChain,
      );
    }
  }

  setInitialBreakpoints(breakpoints: Array<IPCBreakpoint>): void {
    this._breakpointManager.setInitialBreakpoints(breakpoints);
  }

  setFilelineBreakpoint(breakpoint: IPCBreakpoint): void {
    this._breakpointManager.setFilelineBreakpoint(breakpoint);
  }

  removeBreakpoint(breakpoint: IPCBreakpoint): void {
    this._breakpointManager.removeBreakpoint(breakpoint);
  }

  updateBreakpoint(breakpoint: IPCBreakpoint): void {
    this._breakpointManager.updateBreakpoint(breakpoint);
  }

  evaluateExpression(
    transactionId: number,
    expression: string,
    objectGroup: ObjectGroup,
  ): void {
    if (this._pausedMode) {
      const currentFrame = this._stackTraceManager.getCurrentFrame();
      if (currentFrame != null) {
        const callFrameId = currentFrame.callFrameId;
        this._expressionEvaluationManager.evaluateOnCallFrame(
          transactionId,
          callFrameId,
          expression,
          objectGroup,
        );
      }
    } else {
      this._expressionEvaluationManager.runtimeEvaluate(
        transactionId,
        expression,
        objectGroup,
      );
    }

    this._updateCurrentScopes();
  }

  getProperties(id: number, objectId: string): void {
    this._expressionEvaluationManager.getProperties(id, objectId);
  }

  setVariable(
    scopeObjectId: number,
    expression: string,
    newValue: string,
    callback: Function,
  ): void {
    this._debuggerDispatcher.setVariable(
      scopeObjectId,
      expression,
      newValue,
      callback,
    );
  }

  completions(text: string, column: number, callback: Function): void {
    const currentFrame = this._stackTraceManager.getCurrentFrame();
    if (currentFrame != null) {
      const frameId = Number.parseInt(currentFrame.callFrameId, 10);
      this._debuggerDispatcher.completions(text, column, frameId, callback);
    }
  }

  selectThread(threadId: string): void {
    this._threadManager.selectThread(threadId);
    this._threadManager.getThreadStack(threadId).then(stackFrames => {
      this._stackTraceManager.refreshStack(stackFrames);
      this._updateCurrentScopes();
    });
  }

  setSingleThreadStepping(enable: boolean): void {
    this._debuggerSettingsManager.setSingleThreadStepping(enable);
    if (this._engineCreated) {
      this._debuggerSettingsManager.syncToEngine();
    }
  }

  setShowDisassembly(enable: boolean): void {
    this._debuggerSettingsManager.setShowDisassembly(enable);
    if (this._engineCreated) {
      this._debuggerSettingsManager.syncToEngine();
    }
  }

  setPauseOnException(enable: boolean): void {
    this._breakpointManager.setPauseExceptionState({
      state: enable ? 'uncaught' : 'none',
    });
    if (this._engineCreated) {
      this._breakpointManager.syncPauseExceptionState();
    }
  }

  setPauseOnCaughtException(enable: boolean): void {
    if (enable) {
      this._breakpointManager.setPauseExceptionState({
        state: 'all',
      });
    }
    if (this._engineCreated) {
      this._breakpointManager.syncPauseExceptionState();
    }
  }

  _handlePausedEvent(params: PausedEvent) {
    this._pausedMode = true;
    this._stackTraceManager.refreshStack(params.callFrames);
    const currentFrame = this._stackTraceManager.getCurrentFrame();
    this._executionManager.raiseDebuggerPause(
      params,
      currentFrame ? currentFrame.location : null,
    );
    this._updateCurrentScopes();
  }

  _handleDebugEvent = (event: ProtocolDebugEvent): void => {
    switch (event.method) {
      case 'Debugger.loaderBreakpoint': {
        this._engineCreated = true;
        this._debuggerSettingsManager.syncToEngine();
        this._breakpointManager.syncInitialBreakpointsToEngine();
        this._breakpointManager.syncPauseExceptionState();
        // This should be the last method called.
        if (!this._executionManager.continueFromLoaderBreakpoint()) {
          // If this target was not resumed from the loader breakpoint, handle
          // this as a paused event.
          const params: PausedEvent = event.params;
          this._handlePausedEvent(params);
        }
        break;
      }
      case 'Debugger.breakpointResolved': {
        const params: BreakpointResolvedEvent = event.params;
        this._breakpointManager.handleBreakpointResolved(params);
        break;
      }
      case 'Debugger.breakpointHitCountChanged': {
        const params: BreakpointHitCountEvent = event.params;
        this._breakpointManager.handleBreakpointHitCountChanged(params);
        break;
      }
      case 'Debugger.resumed':
        this._pausedMode = false;
        this._executionManager.handleDebuggeeResumed();
        break;
      case 'Debugger.paused': {
        const params: PausedEvent = event.params;
        if (this._shouldFilterBreak(params)) {
          // If the debugger front-end wants to filter out this break,
          // auto-resume.
          this._executionManager.resume();
          break;
        }
        this._handlePausedEvent(params);
        break;
      }
      case 'Debugger.threadsUpdated': {
        const params: ThreadsUpdatedEvent = event.params;
        this._threadManager.raiseThreadsUpdated(params);
        break;
      }
      case 'Debugger.threadUpdated': {
        const params: ThreadUpdatedEvent = event.params;
        this._threadManager.raiseThreadUpdated(params);
        break;
      }
      default:
        break;
    }
  };

  getEventObservable(): Observable<IPCEvent> {
    // TODO: hook other debug events when it's ready.
    const breakpointManager = this._breakpointManager;
    const stackTraceManager = this._stackTraceManager;
    const executionManager = this._executionManager;
    const threadManager = this._threadManager;
    const expessionEvaluatorManager = this._expressionEvaluationManager;
    return breakpointManager
      .getEventObservable()
      .merge(stackTraceManager.getEventObservable())
      .merge(executionManager.getEventObservable())
      .merge(threadManager.getEventObservable())
      .merge(expessionEvaluatorManager.getEventObservable())
      .merge(EventReporter.getEventObservable())
      .map(args => {
        return {channel: 'notification', args};
      });
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}
