'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import nuclideUri from '../../commons-node/nuclideUri';
import type DebuggerDispatcher from './DebuggerDispatcher';
import type {
  NuclideDebuggerProvider,
  NuclideEvaluationExpressionProvider,
} from '../../nuclide-debugger-interfaces/service';
import type {DebuggerStore} from './DebuggerStore';
import type {
  DebuggerProcessInfo,
  DebuggerInstanceBase,
} from '../../nuclide-debugger-base';
import type {
  Callstack,
  ControlButtonSpecification,
  DebuggerModeType,
  ExpansionResult,
  ExpressionResult,
  GetPropertiesResult,
  NuclideThreadData,
  ThreadItem,
} from './types';

import {ActionTypes} from './DebuggerDispatcher';
import {CompositeDisposable} from 'atom';
import {beginTimerTracking, failTimerTracking, endTimerTracking} from './AnalyticsHelper';
import invariant from 'assert';
import {DebuggerMode} from './DebuggerStore';
import passesGK from '../../commons-node/passesGK';
import {track} from '../../nuclide-analytics';
import {getLogger} from '../../nuclide-logging';
import {stringifyError} from '../../commons-node/string';
const logger = getLogger();

const AnalyticsEvents = Object.freeze({
  DEBUGGER_START: 'debugger-start',
  DEBUGGER_START_FAIL: 'debugger-start-fail',
  DEBUGGER_STOP: 'debugger-stop',
});

const GK_DEBUGGER_REQUEST_WINDOW = 'nuclide_debugger_php_request_window';
const GK_DEBUGGER_THREADS_WINDOW = 'nuclide_debugger_threads_window';
const GK_DEBUGGER_REQUEST_SENDER = 'nuclide_debugger_request_sender';

/**
 * Flux style action creator for actions that affect the debugger.
 */
class DebuggerActions {
  _disposables: CompositeDisposable;
  _dispatcher: DebuggerDispatcher;
  _store: DebuggerStore;

  constructor(dispatcher: DebuggerDispatcher, store: DebuggerStore) {
    this._disposables = new CompositeDisposable();
    this._dispatcher = dispatcher;
    this._store = store;
  }

  async startDebugging(processInfo: DebuggerProcessInfo): Promise<void> {
    track(AnalyticsEvents.DEBUGGER_START, {
      serviceName: processInfo.getServiceName(),
    });
    beginTimerTracking('nuclide-debugger-atom:startDebugging');

    this.stopDebugging(); // stop existing session.
    this.setError(null);
    this._handleDebugModeStart();
    this.setDebuggerMode(DebuggerMode.STARTING);
    try {
      atom.commands.dispatch(atom.views.getView(atom.workspace), 'nuclide-debugger:show');
      const debuggerInstance = await processInfo.debug();
      this._registerConsole();
      const supportThreadsWindow = processInfo.supportThreads()
        && await passesGK(GK_DEBUGGER_THREADS_WINDOW) &&
        await this._allowThreadsForPhp(processInfo);
      this._store.getSettings().set('SupportThreadsWindow', supportThreadsWindow);
      const singleThreadStepping = processInfo.supportSingleThreadStepping();
      if (singleThreadStepping) {
        this._store.getSettings().set('SingleThreadStepping', singleThreadStepping);
        const singleThreadSteppingEnabled = processInfo.singleThreadSteppingEnabled();
        this.toggleSingleThreadStepping(singleThreadSteppingEnabled);
      }
      if (processInfo.getServiceName() !== 'hhvm' || await passesGK(GK_DEBUGGER_REQUEST_SENDER)) {
        const customControlButtons = processInfo.customControlButtons();
        if (customControlButtons.length > 0) {
          this.updateControlButtons(customControlButtons);
        } else {
          this.updateControlButtons([]);
        }
      }
      await this._waitForChromeConnection(debuggerInstance);
    } catch (err) {
      failTimerTracking(err);
      track(AnalyticsEvents.DEBUGGER_START_FAIL, {});
      const errorMessage = `Failed to start debugger process: ${stringifyError(err)}`;
      this.setError(errorMessage);
      atom.notifications.addError(errorMessage);
      this.stopDebugging();
    }
  }

  async _allowThreadsForPhp(processInfo: DebuggerProcessInfo): Promise<boolean> {
    if (processInfo.getServiceName() === 'hhvm') {
      return await passesGK(GK_DEBUGGER_REQUEST_WINDOW);
    }
    return true;
  }

  setDebuggerMode(debuggerMode: DebuggerModeType): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.DEBUGGER_MODE_CHANGE,
      data: debuggerMode,
    });
  }

  async _waitForChromeConnection(debuggerInstance: DebuggerInstanceBase): Promise<void> {
    this._setDebuggerInstance(debuggerInstance);
    if (debuggerInstance.onSessionEnd != null) {
      const handler = this._handleSessionEnd.bind(this, debuggerInstance);
      invariant(debuggerInstance.onSessionEnd);
      this._disposables.add(debuggerInstance.onSessionEnd(handler));
    }

    const socketAddr = await debuggerInstance.getWebsocketAddress();
    endTimerTracking();

    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_PROCESS_SOCKET,
      data: socketAddr,
    });
    // Debugger finished initializing and entered debug mode.
    this.setDebuggerMode(DebuggerMode.RUNNING);

    // Wait for 'resume' event from Bridge.js to guarantee we've passed the loader breakpoint.
    await this._store.loaderBreakpointResumePromise;
  }

  _setDebuggerInstance(debuggerInstance: ?DebuggerInstanceBase): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_DEBUGGER_INSTANCE,
      data: debuggerInstance,
    });
  }

  _handleSessionEnd(debuggerInstance: DebuggerInstanceBase): void {
    if (this._store.getDebuggerInstance() === debuggerInstance) {
      this.stopDebugging();
    } else {
      // Do nothing, because either:
      // 1. Another DebuggerInstance is alive. or
      // 2. DebuggerInstance has been disposed.
    }
  }

  stopDebugging() {
    if (this._store.getDebuggerMode() === DebuggerMode.STOPPING) {
      return;
    }
    this.setDebuggerMode(DebuggerMode.STOPPING);
    this._unregisterConsole();
    const debuggerInstance = this._store.getDebuggerInstance();
    if (debuggerInstance != null) {
      debuggerInstance.dispose();
      this._setDebuggerInstance(null);
    }
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_PROCESS_SOCKET,
      data: null,
    });
    this.setDebuggerMode(DebuggerMode.STOPPED);
    track(AnalyticsEvents.DEBUGGER_STOP);
    endTimerTracking();

    invariant(this._store.getDebuggerInstance() === null);
    atom.commands.dispatch(atom.views.getView(atom.workspace), 'nuclide-debugger:hide');
  }

  _registerConsole(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.REGISTER_CONSOLE,
      data: {},
    });
  }

  _unregisterConsole(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UNREGISTER_CONSOLE,
      data: {},
    });
  }

  addConsoleRegisterFunction(registerExecutor: () => IDisposable): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ADD_REGISTER_EXECUTOR,
      data: registerExecutor,
    });
  }

  removeConsoleRegisterFunction(registerExecutor: () => IDisposable): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.REMOVE_REGISTER_EXECUTOR,
      data: registerExecutor,
    });
  }

  updateControlButtons(buttons: Array<ControlButtonSpecification>): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_CUSTOM_CONTROL_BUTTONS,
      data: buttons,
    });
  }

  addDebuggerProvider(provider: NuclideDebuggerProvider) {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ADD_DEBUGGER_PROVIDER,
      data: provider,
    });
  }

  removeDebuggerProvider(provider: NuclideDebuggerProvider) {
    this._dispatcher.dispatch({
      actionType: ActionTypes.REMOVE_DEBUGGER_PROVIDER,
      data: provider,
    });
  }

  addEvaluationExpressionProvider(provider: NuclideEvaluationExpressionProvider) {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ADD_EVALUATION_EXPRESSION_PROVIDER,
      data: provider,
    });
  }

  removeEvaluationExpressionProvider(provider: NuclideEvaluationExpressionProvider) {
    this._dispatcher.dispatch({
      actionType: ActionTypes.REMOVE_EVALUATION_EXPRESSION_PROVIDER,
      data: provider,
    });
  }

  setError(error: ?string) {
    if (error != null) {
      logger.error(error);
    }
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_ERROR,
      data: error,
    });
  }

  /**
   * Utility for debugging.
   *
   * This can be used to set an existing socket, bypassing normal UI flow to
   * improve iteration speed for development.
   */
  forceProcessSocket(socketAddr: ?string) {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_PROCESS_SOCKET,
      data: socketAddr,
    });
  }

  /**
   * Utility for getting refreshed connections.
   * TODO: refresh connections when new directories are removed/added in file-tree.
   */
  updateConnections(): void {

    const connections = this._getRemoteConnections();
    // Always have one single local connection.
    connections.push('local');
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_CONNECTIONS,
      data: connections,
    });
  }

  /**
   * Get remote connections without duplication.
   */
  _getRemoteConnections(): Array<string> {
    // TODO: move this logic into RemoteConnection package.
    return atom.project.getPaths().filter(path => {
      return nuclideUri.isRemote(path);
    }).map(remotePath => {
      const {hostname} = nuclideUri.parseRemoteUri(remotePath);
      return nuclideUri.createRemoteUri(hostname, '/');
    }).filter((path, index, inputArray) => {
      return inputArray.indexOf(path) === index;
    });
  }

  addWatchExpression(expression: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ADD_WATCH_EXPRESSION,
      data: {
        expression,
      },
    });
  }

  removeWatchExpression(index: number): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.REMOVE_WATCH_EXPRESSION,
      data: {
        index,
      },
    });
  }

  updateWatchExpression(index: number, newExpression: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_WATCH_EXPRESSION,
      data: {
        newExpression,
        index,
      },
    });
  }

  openSourceLocation(sourceURL: string, lineNumber: number): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.OPEN_SOURCE_LOCATION,
      data: {
        sourceURL,
        lineNumber,
      },
    });
  }

  /**
   * `actionId` is a debugger action understood by Chrome's `WebInspector.ActionRegistry`.
   */
  triggerDebuggerAction(actionId: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.TRIGGER_DEBUGGER_ACTION,
      data: {
        actionId,
      },
    });
  }

  updateCallstack(callstack: Callstack): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_CALLSTACK,
      data: {
        callstack,
      },
    });
  }

  setSelectedCallFrameIndex(index: number): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_SELECTED_CALLFRAME_INDEX,
      data: {
        index,
      },
    });
  }

  setSelectedCallFrameLine(options: ?{sourceURL: string, lineNumber: number}): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_SELECTED_CALLFRAME_LINE,
      data: {
        options,
      },
    });
  }

  clearInterface(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.CLEAR_INTERFACE,
      data: {},
    });
  }

  addBreakpoint(path: string, line: number): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ADD_BREAKPOINT,
      data: {
        path,
        line,
      },
    });
  }

  updateBreakpointEnabled(breakpointId: number, enabled: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_BREAKPOINT_ENABLED,
      data: {
        breakpointId,
        enabled,
      },
    });
  }

  updateBreakpointCondition(breakpointId: number, condition: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_BREAKPOINT_CONDITION,
      data: {
        breakpointId,
        condition,
      },
    });
  }

  deleteBreakpoint(path: string, line: number): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.DELETE_BREAKPOINT,
      data: {
        path,
        line,
      },
    });
  }

  deleteAllBreakpoints(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.DELETE_ALL_BREAKPOINTS,
      data: {},
    });
  }

  toggleBreakpoint(path: string, line: number): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.TOGGLE_BREAKPOINT,
      data: {
        path,
        line,
      },
    });
  }

  deleteBreakpointIPC(path: string, line: number): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.DELETE_BREAKPOINT_IPC,
      data: {
        path,
        line,
      },
    });
  }

  bindBreakpointIPC(path: string, line: number, condition: string, enabled: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.BIND_BREAKPOINT_IPC,
      data: {
        path,
        line,
        condition,
        enabled,
      },
    });
  }

  togglePauseOnException(pauseOnException: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.TOGGLE_PAUSE_ON_EXCEPTION,
      data: pauseOnException,
    });
  }

  togglePauseOnCaughtException(pauseOnCaughtException: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.TOGGLE_PAUSE_ON_CAUGHT_EXCEPTION,
      data: pauseOnCaughtException,
    });
  }

  toggleSingleThreadStepping(singleThreadStepping: boolean): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.TOGGLE_SINGLE_THREAD_STEPPING,
      data: singleThreadStepping,
    });
  }

  updateLocals(locals: ExpansionResult): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_LOCALS,
      data: {
        locals,
      },
    });
  }

  dispose() {
    endTimerTracking();
    this._disposables.dispose();
  }

  updateThreads(threadData: NuclideThreadData): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_THREADS,
      data: {
        threadData,
      },
    });
  }

  updateThread(thread: ThreadItem): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_THREAD,
      data: {
        thread,
      },
    });
  }

  updateStopThread(id: number): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_STOP_THREAD,
      data: {
        id,
      },
    });
  }

  notifyThreadSwitch(sourceURL: string, lineNumber: number, message: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.NOTIFY_THREAD_SWITCH,
      data: {
        sourceURL,
        lineNumber,
        message,
      },
    });
  }

  receiveExpressionEvaluationResponse(id: number, response: ExpressionResult): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.RECEIVED_EXPRESSION_EVALUATION_RESPONSE,
      data: {
        id,
        response,
      },
    });
  }

  receiveGetPropertiesResponse(id: number, response: GetPropertiesResult): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.RECEIVED_GET_PROPERTIES_RESPONSE,
      data: {
        id,
        response,
      },
    });
  }

  _handleDebugModeStart(): void {
    // Open the console window if it's not already opened.
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-console:toggle',
      {visible: true},
    );
  }
}

module.exports = DebuggerActions;
