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

import type DebuggerDispatcher, {DebuggerAction} from './DebuggerDispatcher';
import type {
  SerializedBreakpoint,
  FileLineBreakpoint,
  FileLineBreakpoints,
  BreakpointUserChangeArgType,
  DebuggerModeType,
} from './types';

import invariant from 'assert';
import {Disposable, CompositeDisposable} from 'atom';
import {Emitter} from 'atom';
import {ActionTypes} from './DebuggerDispatcher';
import {DebuggerMode} from './DebuggerStore';
import {DebuggerStore} from './DebuggerStore';
import nuclideUri from 'nuclide-commons/nuclideUri';

export type LineToBreakpointMap = Map<number, FileLineBreakpoint>;

const BREAKPOINT_NEED_UI_UPDATE = 'BREAKPOINT_NEED_UI_UPDATE';
const BREAKPOINT_USER_CHANGED = 'breakpoint_user_changed';

const ADDBREAKPOINT_ACTION = 'AddBreakpoint';
const DELETEBREAKPOINT_ACTION = 'DeleteBreakpoint';

/**
 * Stores the currently set breakpoints as (path, line) pairs.
 *
 * Mutations to this object fires off high level events to listeners such as UI
 * controllers, giving them a chance to update.
 */
export default class BreakpointStore {
  _disposables: IDisposable;
  _breakpoints: Map<string, LineToBreakpointMap>;
  _idToBreakpointMap: Map<number, FileLineBreakpoint>;
  _emitter: atom$Emitter;
  _breakpointIdSeed: number;
  _debuggerStore: ?DebuggerStore;

  constructor(
    dispatcher: DebuggerDispatcher,
    initialBreakpoints: ?Array<SerializedBreakpoint>,
    debuggerStore: ?DebuggerStore,
  ) {
    const dispatcherToken = dispatcher.register(this._handlePayload.bind(this));
    this._disposables = new CompositeDisposable(
      new Disposable(() => {
        dispatcher.unregister(dispatcherToken);
      }),
    );
    this._debuggerStore = debuggerStore;
    this._breakpointIdSeed = 0;
    this._breakpoints = new Map();
    this._idToBreakpointMap = new Map();
    this._emitter = new Emitter();
    if (initialBreakpoints) {
      this._deserializeBreakpoints(initialBreakpoints);
    }
  }

  _handlePayload(payload: DebuggerAction): void {
    switch (payload.actionType) {
      case ActionTypes.ADD_BREAKPOINT:
        this._addBreakpoint(payload.data.path, payload.data.line);
        break;
      case ActionTypes.UPDATE_BREAKPOINT_CONDITION:
        this._updateBreakpointCondition(
          payload.data.breakpointId,
          payload.data.condition,
        );
        break;
      case ActionTypes.UPDATE_BREAKPOINT_ENABLED:
        this._updateBreakpointEnabled(
          payload.data.breakpointId,
          payload.data.enabled,
        );
        break;
      case ActionTypes.DELETE_BREAKPOINT:
        this._deleteBreakpoint(payload.data.path, payload.data.line);
        break;
      case ActionTypes.DELETE_ALL_BREAKPOINTS:
        this._deleteAllBreakpoints();
        break;
      case ActionTypes.ENABLE_ALL_BREAKPOINTS:
        this._enableAllBreakpoints();
        break;
      case ActionTypes.DISABLE_ALL_BREAKPOINTS:
        this._disableAllBreakpoints();
        break;
      case ActionTypes.TOGGLE_BREAKPOINT:
        this._toggleBreakpoint(payload.data.path, payload.data.line);
        break;
      case ActionTypes.DELETE_BREAKPOINT_IPC:
        this._deleteBreakpoint(payload.data.path, payload.data.line, false);
        break;
      case ActionTypes.UPDATE_BREAKPOINT_HITCOUNT:
        this._updateBreakpointHitcount(
          payload.data.path,
          payload.data.line,
          payload.data.hitCount,
        );
        break;
      case ActionTypes.BIND_BREAKPOINT_IPC:
        this._bindBreakpoint(
          payload.data.path,
          payload.data.line,
          payload.data.condition,
          payload.data.enabled,
          payload.data.resolved,
        );
        break;
      case ActionTypes.DEBUGGER_MODE_CHANGE:
        this._handleDebuggerModeChange(payload.data);
        break;
      default:
        return;
    }
  }

  _addBreakpoint(
    path: string,
    line: number,
    condition: string = '',
    resolved: boolean = false,
    userAction: boolean = true,
    enabled: boolean = true,
  ): void {
    this._breakpointIdSeed++;
    const breakpoint = {
      id: this._breakpointIdSeed,
      path,
      line,
      condition,
      enabled,
      resolved,
    };
    this._idToBreakpointMap.set(breakpoint.id, breakpoint);
    if (!this._breakpoints.has(path)) {
      this._breakpoints.set(path, new Map());
    }
    const lineMap = this._breakpoints.get(path);
    invariant(lineMap != null);
    lineMap.set(line, breakpoint);
    this._emitter.emit(BREAKPOINT_NEED_UI_UPDATE, path);
    if (userAction) {
      this._emitter.emit(BREAKPOINT_USER_CHANGED, {
        action: ADDBREAKPOINT_ACTION,
        breakpoint,
      });
    }
  }

  _updateBreakpointHitcount(
    path: string,
    line: number,
    hitCount: number,
  ): void {
    const breakpoint = this.getBreakpointAtLine(path, line);
    if (breakpoint == null) {
      return;
    }
    breakpoint.hitCount = hitCount;
    this._updateBreakpoint(breakpoint);
  }

  _updateBreakpointEnabled(breakpointId: number, enabled: boolean): void {
    const breakpoint = this._idToBreakpointMap.get(breakpointId);
    if (breakpoint == null) {
      return;
    }
    breakpoint.enabled = enabled;
    this._updateBreakpoint(breakpoint);
  }

  _updateBreakpointCondition(breakpointId: number, condition: string): void {
    const breakpoint = this._idToBreakpointMap.get(breakpointId);
    if (breakpoint == null) {
      return;
    }
    breakpoint.condition = condition;
    this._updateBreakpoint(breakpoint);
  }

  _updateBreakpoint(breakpoint: FileLineBreakpoint): void {
    this._emitter.emit(BREAKPOINT_NEED_UI_UPDATE, breakpoint.path);
    this._emitter.emit(BREAKPOINT_USER_CHANGED, {
      action: 'UpdateBreakpoint',
      breakpoint,
    });
  }

  _forEachBreakpoint(
    callback: (path: string, line: number, breakpointId: number) => void,
  ) {
    for (const path of this._breakpoints.keys()) {
      const lineMap = this._breakpoints.get(path);
      invariant(lineMap != null);
      for (const line of lineMap.keys()) {
        const bp = lineMap.get(line);
        invariant(bp != null);
        callback(path, line, bp.id);
      }
    }
  }

  _deleteAllBreakpoints(): void {
    this._forEachBreakpoint((path, line, breakpointId) =>
      this._deleteBreakpoint(path, line),
    );
  }

  _enableAllBreakpoints(): void {
    this._forEachBreakpoint((path, line, breakpointId) =>
      this._updateBreakpointEnabled(breakpointId, true),
    );
  }

  _disableAllBreakpoints(): void {
    this._forEachBreakpoint((path, line, breakpointId) =>
      this._updateBreakpointEnabled(breakpointId, false),
    );
  }

  _deleteBreakpoint(
    path: string,
    line: number,
    userAction: boolean = true,
  ): void {
    const lineMap = this._breakpoints.get(path);
    if (lineMap == null) {
      return;
    }
    const breakpoint = lineMap.get(line);
    if (lineMap.delete(line)) {
      invariant(breakpoint);
      this._idToBreakpointMap.delete(breakpoint.id);
      this._emitter.emit(BREAKPOINT_NEED_UI_UPDATE, path);
      if (userAction) {
        this._emitter.emit(BREAKPOINT_USER_CHANGED, {
          action: DELETEBREAKPOINT_ACTION,
          breakpoint,
        });
      }
    }
  }

  _toggleBreakpoint(path: string, line: number): void {
    if (!this._breakpoints.has(path)) {
      this._breakpoints.set(path, new Map());
    }
    const lineMap = this._breakpoints.get(path);
    invariant(lineMap != null);
    if (lineMap.has(line)) {
      this._deleteBreakpoint(path, line);
    } else {
      this._addBreakpoint(path, line, '');
    }
  }

  _bindBreakpoint(
    path: string,
    line: number,
    condition: string,
    enabled: boolean,
    resolved: boolean,
  ): void {
    // The Chrome devtools always bind a new breakpoint as enabled the first time. If this
    // breakpoint is known to be disabled in the front-end, sync the enabled state with Chrome.
    const existingBp = this.getBreakpointAtLine(path, line);
    const updateEnabled = existingBp != null && existingBp.enabled !== enabled;

    this._addBreakpoint(
      path,
      line,
      condition,
      resolved,
      false, // userAction
      enabled,
    );

    if (updateEnabled) {
      const updatedBp = this.getBreakpointAtLine(path, line);
      if (updatedBp != null) {
        updatedBp.enabled = !enabled;
        this._updateBreakpoint(updatedBp);
      }
    }

    const debuggerStore = this.getDebuggerStore();
    if (debuggerStore != null) {
      const currentInfo = debuggerStore.getDebugProcessInfo();
      if (
        condition !== '' &&
        currentInfo != null &&
        !currentInfo.getDebuggerCapabilities().conditionalBreakpoints
      ) {
        // If the current debugger does not support conditional breakpoints, and the bp that
        // was just bound has a condition on it, warn the user that the condition isn't going
        // to be honored.
        atom.notifications.addWarning(
          'The current debugger does not support conditional breakpoints. The breakpoint at this location will hit without ' +
            'evaluating the specified condition expression:\n' +
            `${nuclideUri.basename(path)}:${line}`,
        );
        const updatedBp = this.getBreakpointAtLine(path, line);
        if (updatedBp != null) {
          this._updateBreakpointCondition(updatedBp.id, '');
        }
      }
    }
  }

  _handleDebuggerModeChange(newMode: DebuggerModeType): void {
    if (newMode === DebuggerMode.STOPPED) {
      // All breakpoints should be unresolved after stop debugging.
      this._resetBreakpoints();
    } else {
      for (const breakpoint of this.getAllBreakpoints()) {
        if (!breakpoint.resolved) {
          this._emitter.emit(BREAKPOINT_NEED_UI_UPDATE, breakpoint.path);
        }
      }
    }
  }

  _resetBreakpoints(): void {
    for (const breakpoint of this.getAllBreakpoints()) {
      breakpoint.resolved = false;
      breakpoint.hitCount = undefined;
      this._emitter.emit(BREAKPOINT_NEED_UI_UPDATE, breakpoint.path);
    }
  }

  getBreakpointsForPath(path: string): LineToBreakpointMap {
    if (!this._breakpoints.has(path)) {
      this._breakpoints.set(path, new Map());
    }
    const ret = this._breakpoints.get(path);
    invariant(ret);
    return ret;
  }

  getBreakpointLinesForPath(path: string): Set<number> {
    const lineMap = this._breakpoints.get(path);
    return lineMap != null ? new Set(lineMap.keys()) : new Set();
  }

  getBreakpointAtLine(path: string, line: number): ?FileLineBreakpoint {
    const lineMap = this._breakpoints.get(path);
    if (lineMap == null) {
      return null;
    }
    return lineMap.get(line);
  }

  getAllBreakpoints(): FileLineBreakpoints {
    const breakpoints: FileLineBreakpoints = [];
    for (const [, lineMap] of this._breakpoints) {
      for (const breakpoint of lineMap.values()) {
        breakpoints.push(breakpoint);
      }
    }
    return breakpoints;
  }

  getSerializedBreakpoints(): Array<SerializedBreakpoint> {
    const breakpoints = [];
    for (const [path, lineMap] of this._breakpoints) {
      for (const line of lineMap.keys()) {
        const breakpoint = lineMap.get(line);
        if (breakpoint == null) {
          continue;
        }

        breakpoints.push({
          line,
          sourceURL: path,
          disabled: !breakpoint.enabled,
          condition: breakpoint.condition,
        });
      }
    }
    return breakpoints;
  }

  getDebuggerStore(): ?DebuggerStore {
    return this._debuggerStore;
  }

  breakpointSupportsConditions(breakpoint: FileLineBreakpoint): boolean {
    // If currently debugging, return whether or not the current debugger supports this.
    const debuggerStore = this.getDebuggerStore();
    if (
      debuggerStore != null &&
      debuggerStore.getDebuggerMode() !== DebuggerMode.STOPPED
    ) {
      const currentDebugInfo = debuggerStore.getDebugProcessInfo();
      if (currentDebugInfo != null) {
        return currentDebugInfo.getDebuggerCapabilities()
          .conditionalBreakpoints;
      }
    }

    // If not currently debugging, return if any of the debuggers that support
    // the file extension this bp is in support conditions.
    // TODO: have providers register their file extensions and filter correctly here.
    return true;
  }

  _deserializeBreakpoints(breakpoints: Array<SerializedBreakpoint>): void {
    for (const breakpoint of breakpoints) {
      const {line, sourceURL, disabled, condition} = breakpoint;
      this._addBreakpoint(
        sourceURL,
        line,
        condition || '',
        false, // resolved
        false, // user action
        !disabled, // enabled
      );
    }
  }

  /**
   * Register a change handler that is invoked when the breakpoints UI
   * needs to be updated for a file.
   */
  onNeedUIUpdate(callback: (path: string) => void): IDisposable {
    return this._emitter.on(BREAKPOINT_NEED_UI_UPDATE, callback);
  }

  /**
   * Register a change handler that is invoked when a breakpoint is changed
   * by user action, like user explicitly added, deleted a breakpoint.
   */
  onUserChange(
    callback: (params: BreakpointUserChangeArgType) => void,
  ): IDisposable {
    return this._emitter.on(BREAKPOINT_USER_CHANGED, callback);
  }

  dispose(): void {
    this._emitter.dispose();
    this._disposables.dispose();
  }
}
