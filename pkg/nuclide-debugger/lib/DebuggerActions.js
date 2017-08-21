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

import nuclideUri from 'nuclide-commons/nuclideUri';
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
  ExpressionResult,
  GetPropertiesResult,
  NuclideThreadData,
  ScopeSection,
  ThreadItem,
} from './types';

import {ActionTypes} from './DebuggerDispatcher';
import {AnalyticsEvents} from './constants';
import {CompositeDisposable} from 'atom';
import {
  beginTimerTracking,
  failTimerTracking,
  endTimerTracking,
} from './AnalyticsHelper';
import invariant from 'assert';
import {DebuggerMode} from './DebuggerStore';
import passesGK from '../../commons-node/passesGK';
import {track} from '../../nuclide-analytics';
import {getLogger} from 'log4js';
const logger = getLogger('nuclide-debugger');
import ChromeActionRegistryActions from './ChromeActionRegistryActions';

const GK_DEBUGGER_REQUEST_WINDOW = 'nuclide_debugger_php_request_window';
const GK_DEBUGGER_REQUEST_SENDER = 'nuclide_debugger_request_sender';

// This must match URI defined in ../../nuclide-console/lib/ui/ConsoleContainer
const CONSOLE_VIEW_URI = 'atom://nuclide/console';

/**
 * Flux style action creator for actions that affect the debugger.
 */
export default class DebuggerActions {
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
    this.setDebugProcessInfo(processInfo);
    try {
      const debuggerCapabilities = processInfo.getDebuggerCapabilities();
      const debuggerProps = processInfo.getDebuggerProps();
      const debuggerInstance = await processInfo.debug();
      await this._store.getBridge().setupNuclideChannel(debuggerInstance);
      this._registerConsole();
      const supportThreadsWindow =
        debuggerCapabilities.threads &&
        (await this._allowThreadsForPhp(processInfo));
      this._store
        .getSettings()
        .set('SupportThreadsWindow', supportThreadsWindow);
      if (supportThreadsWindow) {
        this._store
          .getSettings()
          .set('CustomThreadColumns', debuggerProps.threadColumns);
        this._store
          .getSettings()
          .set('threadsComponentTitle', debuggerProps.threadsComponentTitle);
      }
      const singleThreadStepping = debuggerCapabilities.singleThreadStepping;
      this._store
        .getSettings()
        .set('SingleThreadStepping', singleThreadStepping);
      this.toggleSingleThreadStepping(singleThreadStepping);
      if (
        processInfo.getServiceName() !== 'hhvm' ||
        (await passesGK(GK_DEBUGGER_REQUEST_SENDER))
      ) {
        const customControlButtons = debuggerProps.customControlButtons;
        if (customControlButtons.length > 0) {
          this.updateControlButtons(customControlButtons);
        } else {
          this.updateControlButtons([]);
        }
      }

      if (debuggerCapabilities.customSourcePaths) {
        this.updateConfigureSourcePathsCallback(
          processInfo.configureSourceFilePaths.bind(processInfo),
        );
      } else {
        this.updateConfigureSourcePathsCallback(null);
      }

      atom.commands.dispatch(
        atom.views.getView(atom.workspace),
        'nuclide-debugger:show',
      );

      await this._waitForChromeConnection(debuggerInstance);
    } catch (err) {
      failTimerTracking(err);
      track(AnalyticsEvents.DEBUGGER_START_FAIL, {});
      const errorMessage = `Failed to start debugger process: ${err}`;
      this.setError(errorMessage);
      atom.notifications.addError(errorMessage);
      this.stopDebugging();
    }
  }

  async _allowThreadsForPhp(
    processInfo: DebuggerProcessInfo,
  ): Promise<boolean> {
    if (processInfo.getServiceName() === 'hhvm') {
      return passesGK(GK_DEBUGGER_REQUEST_WINDOW);
    }
    return true;
  }

  setDebuggerMode(debuggerMode: DebuggerModeType): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.DEBUGGER_MODE_CHANGE,
      data: debuggerMode,
    });
  }

  async _waitForChromeConnection(
    debuggerInstance: DebuggerInstanceBase,
  ): Promise<void> {
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

    this.clearInterface();
    this.updateControlButtons([]);
    this.setDebuggerMode(DebuggerMode.STOPPED);
    this.setDebugProcessInfo(null);
    this.updateConfigureSourcePathsCallback(null);
    track(AnalyticsEvents.DEBUGGER_STOP);
    endTimerTracking();

    invariant(this._store.getDebuggerInstance() == null);
  }

  restartDebugger() {
    const currentDebuggerInfo = this._store.getDebugProcessInfo();
    if (
      currentDebuggerInfo == null ||
      this._store.getDebuggerMode() === DebuggerMode.STOPPED
    ) {
      atom.notifications.addWarning(
        'Cannot restart the debugger: the debugger is not currently running!',
      );
      return;
    }

    // Clone the current debugger info before stopping debugging, as stop will dispose it.
    const newDebuggerInfo = currentDebuggerInfo.clone();
    invariant(newDebuggerInfo);

    this.startDebugging(newDebuggerInfo);
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

  updateConfigureSourcePathsCallback(callback: ?() => void): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_CONFIGURE_SOURCE_PATHS_CALLBACK,
      data: callback,
    });
  }

  configureSourcePaths(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.CONFIGURE_SOURCE_PATHS,
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

  addEvaluationExpressionProvider(
    provider: NuclideEvaluationExpressionProvider,
  ) {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ADD_EVALUATION_EXPRESSION_PROVIDER,
      data: provider,
    });
  }

  removeEvaluationExpressionProvider(
    provider: NuclideEvaluationExpressionProvider,
  ) {
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
    return atom.project
      .getPaths()
      .filter(path => {
        return nuclideUri.isRemote(path);
      })
      .map(remotePath => {
        const {hostname} = nuclideUri.parseRemoteUri(remotePath);
        return nuclideUri.createRemoteUri(hostname, '/');
      })
      .filter((path, index, inputArray) => {
        return inputArray.indexOf(path) === index;
      });
  }

  addWatchExpression(expression: string): void {
    track(AnalyticsEvents.DEBUGGER_WATCH_ADD_EXPRESSION);
    this._dispatcher.dispatch({
      actionType: ActionTypes.ADD_WATCH_EXPRESSION,
      data: {
        expression,
      },
    });
  }

  removeWatchExpression(index: number): void {
    track(AnalyticsEvents.DEBUGGER_WATCH_REMOVE_EXPRESSION);
    this._dispatcher.dispatch({
      actionType: ActionTypes.REMOVE_WATCH_EXPRESSION,
      data: {
        index,
      },
    });
  }

  updateWatchExpression(index: number, newExpression: string): void {
    track(AnalyticsEvents.DEBUGGER_WATCH_UPDATE_EXPRESSION);
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
    switch (actionId) {
      case ChromeActionRegistryActions.RUN:
        track(AnalyticsEvents.DEBUGGER_STEP_CONTINUE);
        break;
      case ChromeActionRegistryActions.PAUSE:
        track(AnalyticsEvents.DEBUGGER_STEP_PAUSE);
        break;
      case ChromeActionRegistryActions.STEP_INTO:
        track(AnalyticsEvents.DEBUGGER_STEP_INTO);
        break;
      case ChromeActionRegistryActions.STEP_OVER:
        track(AnalyticsEvents.DEBUGGER_STEP_OVER);
        break;
      case ChromeActionRegistryActions.STEP_OUT:
        track(AnalyticsEvents.DEBUGGER_STEP_OUT);
        break;
      default:
        logger.error('Unkown debugger action type', actionId);
        break;
    }
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

  setSelectedCallFrameLine(
    options: ?{sourceURL: string, lineNumber: number},
  ): void {
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
    track(AnalyticsEvents.DEBUGGER_BREAKPOINT_ADD);
    this._dispatcher.dispatch({
      actionType: ActionTypes.ADD_BREAKPOINT,
      data: {
        path,
        line,
      },
    });
  }

  updateBreakpointEnabled(breakpointId: number, enabled: boolean): void {
    track(AnalyticsEvents.DEBUGGER_BREAKPOINT_TOGGLE_ENABLED, {enabled});
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_BREAKPOINT_ENABLED,
      data: {
        breakpointId,
        enabled,
      },
    });
  }

  updateBreakpointCondition(breakpointId: number, condition: string): void {
    track(AnalyticsEvents.DEBUGGER_BREAKPOINT_UPDATE_CONDITION, {condition});
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_BREAKPOINT_CONDITION,
      data: {
        breakpointId,
        condition,
      },
    });
  }

  deleteBreakpoint(path: string, line: number): void {
    track(AnalyticsEvents.DEBUGGER_BREAKPOINT_DELETE);
    this._dispatcher.dispatch({
      actionType: ActionTypes.DELETE_BREAKPOINT,
      data: {
        path,
        line,
      },
    });
  }

  deleteAllBreakpoints(): void {
    track(AnalyticsEvents.DEBUGGER_BREAKPOINT_DELETE_ALL);
    this._dispatcher.dispatch({
      actionType: ActionTypes.DELETE_ALL_BREAKPOINTS,
      data: {},
    });
  }

  enableAllBreakpoints(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ENABLE_ALL_BREAKPOINTS,
      data: {},
    });
  }

  disableAllBreakpoints(): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.DISABLE_ALL_BREAKPOINTS,
      data: {},
    });
  }

  toggleBreakpoint(path: string, line: number): void {
    track(AnalyticsEvents.DEBUGGER_BREAKPOINT_TOGGLE);
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

  updateBreakpointHitCount(path: string, line: number, hitCount: number): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_BREAKPOINT_HITCOUNT,
      data: {
        path,
        line,
        hitCount,
      },
    });
  }

  bindBreakpointIPC(
    path: string,
    line: number,
    condition: string,
    enabled: boolean,
    resolved: boolean,
  ): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.BIND_BREAKPOINT_IPC,
      data: {
        path,
        line,
        condition,
        enabled,
        resolved,
      },
    });
  }

  togglePauseOnException(pauseOnException: boolean): void {
    track(AnalyticsEvents.DEBUGGER_TOGGLE_PAUSE_EXCEPTION, {pauseOnException});
    this._dispatcher.dispatch({
      actionType: ActionTypes.TOGGLE_PAUSE_ON_EXCEPTION,
      data: pauseOnException,
    });
  }

  togglePauseOnCaughtException(pauseOnCaughtException: boolean): void {
    track(AnalyticsEvents.DEBUGGER_TOGGLE_CAUGHT_EXCEPTION, {
      pauseOnCaughtException,
    });
    this._dispatcher.dispatch({
      actionType: ActionTypes.TOGGLE_PAUSE_ON_CAUGHT_EXCEPTION,
      data: pauseOnCaughtException,
    });
  }

  toggleSingleThreadStepping(singleThreadStepping: boolean): void {
    track(AnalyticsEvents.DEBUGGER_TOGGLE_SINGLE_THREAD_STEPPING, {
      singleThreadStepping,
    });
    this._dispatcher.dispatch({
      actionType: ActionTypes.TOGGLE_SINGLE_THREAD_STEPPING,
      data: singleThreadStepping,
    });
  }

  updateScopes(scopeSections: Array<ScopeSection>): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_SCOPES,
      data: scopeSections,
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

  updateSelectedThread(id: number): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.UPDATE_SELECTED_THREAD,
      data: {
        id,
      },
    });
  }

  notifyThreadSwitch(
    sourceURL: string,
    lineNumber: number,
    message: string,
  ): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.NOTIFY_THREAD_SWITCH,
      data: {
        sourceURL,
        lineNumber,
        message,
      },
    });
  }

  openDevTools(): void {
    this._dispatcher.dispatch({actionType: ActionTypes.OPEN_DEV_TOOLS});
  }

  receiveExpressionEvaluationResponse(
    id: number,
    response: ExpressionResult,
  ): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.RECEIVED_EXPRESSION_EVALUATION_RESPONSE,
      data: {
        id,
        response,
      },
    });
  }

  receiveGetPropertiesResponse(
    id: number,
    response: GetPropertiesResult,
  ): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.RECEIVED_GET_PROPERTIES_RESPONSE,
      data: {
        id,
        response,
      },
    });
  }

  setDebugProcessInfo(processInfo: ?DebuggerProcessInfo): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.SET_DEBUG_PROCESS_INFO,
      data: processInfo,
    });
  }

  _handleDebugModeStart(): void {
    // Open the console window if it's not already opened.
    // eslint-disable-next-line nuclide-internal/atom-apis
    atom.workspace.open(CONSOLE_VIEW_URI);
  }
}
