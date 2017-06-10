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
  NuclideEvaluationExpressionProvider,
} from '../../nuclide-debugger-interfaces/service';
import type {DebuggerInstanceBase} from '../../nuclide-debugger-base';
import type DebuggerModel from './DebuggerModel';
import type DebuggerDispatcher, {DebuggerAction} from './DebuggerDispatcher';
import type {RegisterExecutorFunction} from '../../nuclide-console/lib/types';
import type {ControlButtonSpecification, DebuggerModeType} from './types';
import type Bridge from './Bridge';

import {Emitter} from 'atom';
import {DebuggerSettings} from './DebuggerSettings';
import invariant from 'assert';
import {ActionTypes} from './DebuggerDispatcher';
import type {DebuggerProcessInfo} from '../../nuclide-debugger-base';

export const DebuggerMode = Object.freeze({
  STARTING: 'starting',
  RUNNING: 'running',
  PAUSED: 'paused',
  STOPPING: 'stopping',
  STOPPED: 'stopped',
});

// This is to work around flow's missing support of enums.
(DebuggerMode: {[key: string]: DebuggerModeType});

const DEBUGGER_CHANGE_EVENT = 'change';
const DEBUGGER_MODE_CHANGE_EVENT = 'debugger mode change';

/**
 * Flux style Store holding all data used by the debugger plugin.
 */
export class DebuggerStore {
  _model: DebuggerModel;
  _dispatcher: DebuggerDispatcher;
  _dispatcherToken: string;
  _emitter: Emitter;

  // Stored values
  _debuggerSettings: DebuggerSettings;
  _debuggerInstance: ?DebuggerInstanceBase;
  _error: ?string;
  _evaluationExpressionProviders: Set<NuclideEvaluationExpressionProvider>;
  _processSocket: ?string;
  _debuggerMode: DebuggerModeType;
  _togglePauseOnException: boolean;
  _togglePauseOnCaughtException: boolean;
  _enableSingleThreadStepping: boolean;
  _onLoaderBreakpointResume: () => void;
  _registerExecutor: ?() => IDisposable;
  _consoleDisposable: ?IDisposable;
  _customControlButtons: Array<ControlButtonSpecification>;
  _debugProcessInfo: ?DebuggerProcessInfo;
  _setSourcePathCallback: ?() => void;
  loaderBreakpointResumePromise: Promise<void>;

  constructor(dispatcher: DebuggerDispatcher, model: DebuggerModel) {
    this._dispatcher = dispatcher;
    this._model = model;
    this._emitter = new Emitter();
    this._dispatcherToken = this._dispatcher.register(
      this._handlePayload.bind(this),
    );

    this._debuggerSettings = new DebuggerSettings();
    this._debuggerInstance = null;
    this._error = null;
    this._evaluationExpressionProviders = new Set();
    this._processSocket = null;
    this._debuggerMode = DebuggerMode.STOPPED;
    this._togglePauseOnException = false;
    this._togglePauseOnCaughtException = false;
    this._enableSingleThreadStepping = false;
    this._registerExecutor = null;
    this._consoleDisposable = null;
    this._customControlButtons = [];
    this._debugProcessInfo = null;
    this._setSourcePathCallback = null;
    this.loaderBreakpointResumePromise = new Promise(resolve => {
      this._onLoaderBreakpointResume = resolve;
    });
  }

  dispose() {
    this._emitter.dispose();
    this._dispatcher.unregister(this._dispatcherToken);
    const debuggerInstance = this._debuggerInstance;
    if (debuggerInstance != null) {
      // On package deactivation, this field is expected to be nulled out, which must happen here
      // because the dispatcher for this store is now unregistered.
      this._debuggerInstance = null;
      debuggerInstance.dispose();
    }
    if (this._debugProcessInfo != null) {
      this._debugProcessInfo.dispose();
    }
  }

  loaderBreakpointResumed(): void {
    this._onLoaderBreakpointResume(); // Resolves onLoaderBreakpointResumePromise.
  }

  getCustomControlButtons(): Array<ControlButtonSpecification> {
    return this._customControlButtons;
  }

  getConsoleExecutorFunction(): ?RegisterExecutorFunction {
    return this._registerExecutor;
  }

  getBridge(): Bridge {
    return this._model.getBridge();
  }

  getDebuggerInstance(): ?DebuggerInstanceBase {
    return this._debuggerInstance;
  }

  getError(): ?string {
    return this._error;
  }

  getProcessSocket(): ?string {
    return this._processSocket;
  }

  getDebuggerMode(): DebuggerModeType {
    return this._debuggerMode;
  }

  isDebugging(): boolean {
    return (
      this._debuggerMode !== DebuggerMode.STOPPED &&
      this._debuggerMode !== DebuggerMode.STOPPING
    );
  }

  getTogglePauseOnException(): boolean {
    return this._togglePauseOnException;
  }

  getTogglePauseOnCaughtException(): boolean {
    return this._togglePauseOnCaughtException;
  }

  getEnableSingleThreadStepping(): boolean {
    return this._enableSingleThreadStepping;
  }

  getSettings(): DebuggerSettings {
    return this._debuggerSettings;
  }

  getEvaluationExpressionProviders(): Set<NuclideEvaluationExpressionProvider> {
    return this._evaluationExpressionProviders;
  }

  getCanSetSourcePaths(): boolean {
    return this._setSourcePathCallback != null;
  }

  getCanRestartDebugger(): boolean {
    return this._debugProcessInfo != null;
  }

  getDebugProcessInfo(): ?DebuggerProcessInfo {
    return this._debugProcessInfo;
  }

  initializeSingleThreadStepping(mode: boolean) {
    this._enableSingleThreadStepping = mode;
  }

  onChange(callback: () => void): IDisposable {
    return this._emitter.on(DEBUGGER_CHANGE_EVENT, callback);
  }

  onDebuggerModeChange(callback: () => void): IDisposable {
    return this._emitter.on(DEBUGGER_MODE_CHANGE_EVENT, callback);
  }

  _handlePayload(payload: DebuggerAction) {
    switch (payload.actionType) {
      case ActionTypes.SET_PROCESS_SOCKET:
        this._processSocket = payload.data;
        break;
      case ActionTypes.SET_ERROR:
        this._error = payload.data;
        break;
      case ActionTypes.SET_DEBUGGER_INSTANCE:
        this._debuggerInstance = payload.data;
        break;
      case ActionTypes.TOGGLE_PAUSE_ON_EXCEPTION:
        const pauseOnException = payload.data;
        this._togglePauseOnException = pauseOnException;
        this._model.getBridge().setPauseOnException(pauseOnException);
        break;
      case ActionTypes.TOGGLE_PAUSE_ON_CAUGHT_EXCEPTION:
        const pauseOnCaughtException = payload.data;
        this._togglePauseOnCaughtException = pauseOnCaughtException;
        this._model
          .getBridge()
          .setPauseOnCaughtException(pauseOnCaughtException);
        break;
      case ActionTypes.TOGGLE_SINGLE_THREAD_STEPPING:
        const singleThreadStepping = payload.data;
        this._enableSingleThreadStepping = singleThreadStepping;
        this._model.getBridge().setSingleThreadStepping(singleThreadStepping);
        break;
      case ActionTypes.DEBUGGER_MODE_CHANGE:
        this._debuggerMode = payload.data;
        if (this._debuggerMode === DebuggerMode.STOPPED) {
          this.loaderBreakpointResumePromise = new Promise(resolve => {
            this._onLoaderBreakpointResume = resolve;
          });
        }
        this._emitter.emit(DEBUGGER_MODE_CHANGE_EVENT);
        break;
      case ActionTypes.ADD_EVALUATION_EXPRESSION_PROVIDER:
        if (this._evaluationExpressionProviders.has(payload.data)) {
          return;
        }
        this._evaluationExpressionProviders.add(payload.data);
        break;
      case ActionTypes.REMOVE_EVALUATION_EXPRESSION_PROVIDER:
        if (!this._evaluationExpressionProviders.has(payload.data)) {
          return;
        }
        this._evaluationExpressionProviders.delete(payload.data);
        break;
      case ActionTypes.ADD_REGISTER_EXECUTOR:
        invariant(this._registerExecutor == null);
        this._registerExecutor = payload.data;
        break;
      case ActionTypes.REMOVE_REGISTER_EXECUTOR:
        invariant(this._registerExecutor === payload.data);
        this._registerExecutor = null;
        break;
      case ActionTypes.REGISTER_CONSOLE:
        if (this._registerExecutor != null) {
          this._consoleDisposable = this._registerExecutor();
        }
        break;
      case ActionTypes.UNREGISTER_CONSOLE:
        if (this._consoleDisposable != null) {
          this._consoleDisposable.dispose();
          this._consoleDisposable = null;
        }
        break;
      case ActionTypes.UPDATE_CUSTOM_CONTROL_BUTTONS:
        this._customControlButtons = payload.data;
        break;
      case ActionTypes.UPDATE_CONFIGURE_SOURCE_PATHS_CALLBACK:
        this._setSourcePathCallback = payload.data;
        break;
      case ActionTypes.CONFIGURE_SOURCE_PATHS:
        if (this._setSourcePathCallback != null) {
          this._setSourcePathCallback();
        }
        break;
      case ActionTypes.SET_DEBUG_PROCESS_INFO:
        if (this._debugProcessInfo != null) {
          this._debugProcessInfo.dispose();
        }
        this._debugProcessInfo = payload.data;
        break;
      default:
        return;
    }
    this._emitter.emit(DEBUGGER_CHANGE_EVENT);
  }
}
