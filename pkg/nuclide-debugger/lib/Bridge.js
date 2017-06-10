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

import type DebuggerModel from './DebuggerModel';
import type {
  Callstack,
  EvalCommand,
  ScopeSection,
  NuclideThreadData,
  ThreadItem,
  BreakpointUserChangeArgType,
  IPCBreakpoint,
  ExpressionResult,
  GetPropertiesResult,
  IPCEvent,
} from './types';

import {Subject} from 'rxjs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {DebuggerMode} from './DebuggerStore';
import invariant from 'assert';
import CommandDispatcher from './CommandDispatcher';
import ChromeActionRegistryActions from './ChromeActionRegistryActions';
import {registerConsoleLogging} from '../../nuclide-debugger-base';
import {getLogger} from 'log4js';
const logger = getLogger('nuclide-debugger');

export default class Bridge {
  _debuggerModel: DebuggerModel;
  _disposables: UniversalDisposable;
  // Contains disposable items that are only available during
  // debug mode.
  _debugModeDisposables: ?UniversalDisposable;
  _commandDispatcher: CommandDispatcher;
  _suppressBreakpointSync: boolean;
  _consoleEvent$: Subject<string>;

  constructor(debuggerModel: DebuggerModel) {
    (this: any)._handleIpcMessage = this._handleIpcMessage.bind(this);
    this._debuggerModel = debuggerModel;
    this._suppressBreakpointSync = false;
    this._commandDispatcher = new CommandDispatcher();
    this._consoleEvent$ = new Subject();
    this._disposables = new UniversalDisposable(
      debuggerModel
        .getBreakpointStore()
        .onUserChange(this._handleUserBreakpointChange.bind(this)),
    );
    const subscription = registerConsoleLogging(
      'Debugger',
      this._consoleEvent$,
    );
    if (subscription != null) {
      this._disposables.add(subscription);
    }
  }

  dispose() {
    this.leaveDebugMode();
    this._disposables.dispose();
  }

  enterDebugMode(): void {
    if (this._debugModeDisposables == null) {
      this._debugModeDisposables = new UniversalDisposable();
    }
  }

  // Clean up any debug mode states.
  leaveDebugMode() {
    if (this._debugModeDisposables != null) {
      this._debugModeDisposables.dispose();
      this._debugModeDisposables = null;
    }
  }

  continue() {
    this._clearInterface();
    this._commandDispatcher.send('Continue');
  }

  pause(): void {
    this._commandDispatcher.send('Pause');
  }

  stepOver() {
    this._clearInterface();
    this._commandDispatcher.send('StepOver');
  }

  stepInto() {
    this._clearInterface();
    this._commandDispatcher.send('StepInto');
  }

  stepOut() {
    this._clearInterface();
    this._commandDispatcher.send('StepOut');
  }

  runToLocation(filePath: string, line: number) {
    this._clearInterface();
    this._commandDispatcher.send('RunToLocation', filePath, line);
  }

  triggerAction(actionId: string): void {
    this._clearInterface();
    switch (actionId) {
      case ChromeActionRegistryActions.RUN:
        this.continue();
        break;
      case ChromeActionRegistryActions.PAUSE:
        this.pause();
        break;
      case ChromeActionRegistryActions.STEP_INTO:
        this.stepInto();
        break;
      case ChromeActionRegistryActions.STEP_OVER:
        this.stepOver();
        break;
      case ChromeActionRegistryActions.STEP_OUT:
        this.stepOut();
        break;
    }
  }

  setSelectedCallFrameIndex(callFrameIndex: number): void {
    this._commandDispatcher.send('setSelectedCallFrameIndex', callFrameIndex);
  }

  setPauseOnException(pauseOnExceptionEnabled: boolean): void {
    this._commandDispatcher.send(
      'setPauseOnException',
      pauseOnExceptionEnabled,
    );
  }

  setPauseOnCaughtException(pauseOnCaughtExceptionEnabled: boolean): void {
    this._commandDispatcher.send(
      'setPauseOnCaughtException',
      pauseOnCaughtExceptionEnabled,
    );
  }

  setSingleThreadStepping(singleThreadStepping: boolean): void {
    this._commandDispatcher.send(
      'setSingleThreadStepping',
      singleThreadStepping,
    );
  }

  selectThread(threadId: string): void {
    this._commandDispatcher.send('selectThread', threadId);
    const threadNo = parseInt(threadId, 10);
    if (!isNaN(threadNo)) {
      this._debuggerModel.getActions().updateSelectedThread(threadNo);
    }
  }

  sendEvaluationCommand(
    command: EvalCommand,
    evalId: number,
    ...args: Array<mixed>
  ): void {
    this._commandDispatcher.send(command, evalId, ...args);
  }

  _handleExpressionEvaluationResponse(
    response: ExpressionResult & {id: number},
  ): void {
    this._debuggerModel
      .getActions()
      .receiveExpressionEvaluationResponse(response.id, response);
  }

  _handleGetPropertiesResponse(
    response: GetPropertiesResult & {id: number},
  ): void {
    this._debuggerModel
      .getActions()
      .receiveGetPropertiesResponse(response.id, response);
  }

  _handleCallstackUpdate(callstack: Callstack): void {
    this._debuggerModel.getActions().updateCallstack(callstack);
  }

  _handleScopesUpdate(scopeSections: Array<ScopeSection>): void {
    this._debuggerModel.getActions().updateScopes(scopeSections);
  }

  _handleIpcMessage(event: IPCEvent): void {
    switch (event.channel) {
      case 'notification':
        switch (event.args[0]) {
          case 'ready':
            if (
              atom.config.get(
                'nuclide.nuclide-debugger.openDevToolsOnDebuggerStart',
              )
            ) {
              this.openDevTools();
            }
            this._sendAllBreakpoints();
            this._syncDebuggerState();
            break;
          case 'CallFrameSelected':
            this._setSelectedCallFrameLine(event.args[1]);
            break;
          case 'OpenSourceLocation':
            this._openSourceLocation(event.args[1]);
            break;
          case 'DebuggerResumed':
            this._handleDebuggerResumed();
            break;
          case 'LoaderBreakpointResumed':
            this._handleLoaderBreakpointResumed();
            break;
          case 'BreakpointAdded':
            // BreakpointAdded from chrome side is actually
            // binding the breakpoint.
            this._bindBreakpoint(
              event.args[1],
              event.args[1].resolved === true,
            );
            break;
          case 'BreakpointRemoved':
            this._removeBreakpoint(event.args[1]);
            break;
          case 'NonLoaderDebuggerPaused':
            this._handleDebuggerPaused(event.args[1]);
            break;
          case 'ExpressionEvaluationResponse':
            this._handleExpressionEvaluationResponse(event.args[1]);
            break;
          case 'GetPropertiesResponse':
            this._handleGetPropertiesResponse(event.args[1]);
            break;
          case 'CallstackUpdate':
            this._handleCallstackUpdate(event.args[1]);
            break;
          case 'ScopesUpdate':
            this._handleScopesUpdate(event.args[1]);
            break;
          case 'ThreadsUpdate':
            this._handleThreadsUpdate(event.args[1]);
            break;
          case 'ThreadUpdate':
            this._handleThreadUpdate(event.args[1]);
            break;
          case 'ReportError':
            this._reportEngineError(event.args[1]);
            break;
          case 'ReportWarning':
            this._reportEngineWarning(event.args[1]);
            break;
        }
        break;
    }
  }

  _sendConsoleMessage(level: string, text: string): void {
    this._consoleEvent$.next(
      JSON.stringify({
        level,
        text,
      }),
    );
  }

  _reportEngineError(message: string): void {
    const outputMessage = `Debugger engine reports error: ${message}`;
    logger.error(outputMessage);
    this._sendConsoleMessage('error', outputMessage);
    atom.notifications.addError(outputMessage);
  }

  _reportEngineWarning(message: string): void {
    const outputMessage = `Debugger engine reports warning: ${message}`;
    logger.warn(outputMessage);
    this._sendConsoleMessage('warning', outputMessage);
    atom.notifications.addWarning(outputMessage);
  }

  _updateDebuggerSettings(): void {
    this._commandDispatcher.send(
      'UpdateSettings',
      this._debuggerModel.getStore().getSettings().getSerializedData(),
    );
  }

  _syncDebuggerState(): void {
    const store = this._debuggerModel.getStore();
    this.setPauseOnException(store.getTogglePauseOnException());
    this.setPauseOnCaughtException(store.getTogglePauseOnCaughtException());
    this.setSingleThreadStepping(store.getEnableSingleThreadStepping());
  }

  _handleDebuggerPaused(
    options: ?{
      stopThreadId: number,
      threadSwitchNotification: {
        sourceURL: string,
        lineNumber: number,
        message: string,
      },
    },
  ): void {
    this._debuggerModel.getActions().setDebuggerMode(DebuggerMode.PAUSED);
    if (options != null) {
      if (options.stopThreadId != null) {
        this._handleStopThreadUpdate(options.stopThreadId);
      }
      this._handleStopThreadSwitch(options.threadSwitchNotification);
    }
  }

  _handleDebuggerResumed(): void {
    this._debuggerModel.getActions().setDebuggerMode(DebuggerMode.RUNNING);
  }

  _handleLoaderBreakpointResumed(): void {
    this._debuggerModel.getStore().loaderBreakpointResumed();
  }

  _clearInterface(): void {
    // Prevent dispatcher re-entrance error.
    process.nextTick(() => this._debuggerModel.getActions().clearInterface());
  }

  _setSelectedCallFrameLine(
    options: ?{sourceURL: string, lineNumber: number},
  ): void {
    this._debuggerModel.getActions().setSelectedCallFrameLine(options);
  }

  _openSourceLocation(options: ?{sourceURL: string, lineNumber: number}): void {
    if (options == null) {
      return;
    }
    this._debuggerModel
      .getActions()
      .openSourceLocation(options.sourceURL, options.lineNumber);
  }

  _handleStopThreadSwitch(
    options: ?{sourceURL: string, lineNumber: number, message: string},
  ) {
    if (options == null) {
      return;
    }
    this._debuggerModel
      .getActions()
      .notifyThreadSwitch(
        options.sourceURL,
        options.lineNumber,
        options.message,
      );
  }

  _bindBreakpoint(breakpoint: IPCBreakpoint, resolved: boolean) {
    const {sourceURL, lineNumber, condition, enabled} = breakpoint;
    const path = nuclideUri.uriToNuclideUri(sourceURL);
    // only handle real files for now.
    if (path) {
      try {
        this._suppressBreakpointSync = true;
        this._debuggerModel
          .getActions()
          .bindBreakpointIPC(path, lineNumber, condition, enabled, resolved);
      } finally {
        this._suppressBreakpointSync = false;
      }
    }
  }

  _removeBreakpoint(breakpoint: IPCBreakpoint) {
    const {sourceURL, lineNumber} = breakpoint;
    const path = nuclideUri.uriToNuclideUri(sourceURL);
    // only handle real files for now.
    if (path) {
      try {
        this._suppressBreakpointSync = true;
        this._debuggerModel.getActions().deleteBreakpointIPC(path, lineNumber);
      } finally {
        this._suppressBreakpointSync = false;
      }
    }
  }

  _handleUserBreakpointChange(params: BreakpointUserChangeArgType) {
    const {action, breakpoint} = params;
    this._commandDispatcher.send(action, {
      sourceURL: nuclideUri.nuclideUriToUri(breakpoint.path),
      lineNumber: breakpoint.line,
      condition: breakpoint.condition,
      enabled: breakpoint.enabled,
    });
  }

  _handleThreadsUpdate(threadData: NuclideThreadData): void {
    this._debuggerModel.getActions().updateThreads(threadData);
  }

  _handleThreadUpdate(thread: ThreadItem): void {
    this._debuggerModel.getActions().updateThread(thread);
  }

  _handleStopThreadUpdate(id: number): void {
    this._debuggerModel.getActions().updateStopThread(id);
  }

  _sendAllBreakpoints() {
    // Send an array of file/line objects.
    if (!this._suppressBreakpointSync) {
      const results = [];
      this._debuggerModel
        .getBreakpointStore()
        .getAllBreakpoints()
        .forEach(breakpoint => {
          results.push({
            sourceURL: nuclideUri.nuclideUriToUri(breakpoint.path),
            lineNumber: breakpoint.line,
            condition: breakpoint.condition,
            enabled: breakpoint.enabled,
          });
        });
      this._commandDispatcher.send('SyncBreakpoints', results);
    }
  }

  enableEventsListening(): void {
    const subscriptions = this._debugModeDisposables;
    invariant(subscriptions != null);
    subscriptions.add(
      this._commandDispatcher
        .getEventObservable()
        .subscribe(this._handleIpcMessage),
    );
    this._signalNewChannelReadyIfNeeded();
    subscriptions.add(() => this._commandDispatcher.cleanupSessionState());
  }

  // This will be unnecessary after we remove 'ready' event.
  _signalNewChannelReadyIfNeeded(): void {
    if (this._commandDispatcher.isNewChannel()) {
      this._handleIpcMessage({
        channel: 'notification',
        args: ['ready'],
      });
    }
  }

  setupChromeChannel(url: string): void {
    this._commandDispatcher.setupChromeChannel(url);
  }

  setupNuclideChannel(debuggerInstance: Object): Promise<void> {
    return this._commandDispatcher.setupNuclideChannel(debuggerInstance);
  }

  openDevTools(): void {
    this._commandDispatcher.openDevTools();
  }
}
