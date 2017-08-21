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

import type {IPCBreakpoint} from '../types';
import type {
  BreakpointId,
  Location,
  BreakpointResolvedEvent,
  BreakpointHitCountEvent,
  SetBreakpointByUrlResponse,
  SetPauseOnExceptionsRequest,
} from '../../../nuclide-debugger-base/lib/protocol-types';
import type DebuggerDomainDispatcher from './DebuggerDomainDispatcher';

import invariant from 'assert';
import {reportError, reportWarning} from './EventReporter';
import {Subject, Observable} from 'rxjs';

const UNCONFIRMED_BREAKPOINT_ID = 'Unassigned';

type UserBreakpoint = {
  id: BreakpointId,
  request: IPCBreakpoint,
};

type BreakpointEngineChangeDisposition =
  | 'NoAction'
  | 'AddBreakpoint'
  | 'RemoveBreakpoint'
  | 'ReplaceBreakpoint';

/**
 * Bridge between Nuclide IPC and RPC breakpoint protocols.
 */
export default class BreakpointManager {
  _debuggerDispatcher: DebuggerDomainDispatcher;
  _initBreakpoints: Array<IPCBreakpoint>;
  _breakpointList: Array<UserBreakpoint>;
  _pauseExceptionRequest: SetPauseOnExceptionsRequest;
  _breakpointEvent$: Subject<Array<mixed>>;

  constructor(debuggerDispatcher: DebuggerDomainDispatcher) {
    this._initBreakpoints = [];
    this._breakpointList = [];
    this._pauseExceptionRequest = {
      state: 'uncaught', // Debugger should catch unhandled exception by default.
    };
    this._breakpointEvent$ = new Subject();
    this._debuggerDispatcher = debuggerDispatcher;
  }

  getEventObservable(): Observable<Array<mixed>> {
    return this._breakpointEvent$.asObservable();
  }

  setInitialBreakpoints(breakpoints: Array<IPCBreakpoint>): void {
    this._initBreakpoints = breakpoints;
  }

  syncInitialBreakpointsToEngine(): void {
    for (const breakpoint of this._initBreakpoints) {
      this.setFilelineBreakpoint(breakpoint);
    }
    this._initBreakpoints = [];
  }

  setPauseExceptionState(request: SetPauseOnExceptionsRequest): void {
    this._pauseExceptionRequest = request;
  }

  syncPauseExceptionState(): void {
    this._debuggerDispatcher.setPauseOnExceptions(this._pauseExceptionRequest);
  }

  setFilelineBreakpoint(request: IPCBreakpoint): void {
    function callback(error: Error, response: SetBreakpointByUrlResponse) {
      if (error != null) {
        reportError(
          `setFilelineBreakpoint failed with ${JSON.stringify(error)}`,
        );
        return;
      }
      const {breakpointId, locations, resolved} = response;
      this._assignBreakpointId(request, breakpointId);

      // true or undefined. This is because any legacy engine may
      // not implement "resolved" flag in resolved resposne.
      if (resolved !== false) {
        for (const location of locations) {
          if (location != null) {
            this._sendBreakpointResolved(breakpointId, location);
          }
        }
      }
    }
    this._breakpointList.push({id: UNCONFIRMED_BREAKPOINT_ID, request});
    if (request.enabled) {
      this._debuggerDispatcher.setBreakpointByUrl(request, callback.bind(this));
    }
  }

  _assignBreakpointId(
    request: IPCBreakpoint,
    breakpointId: BreakpointId,
  ): void {
    const breakpoint = this._findBreakpointOnFileLine(
      request.sourceURL,
      request.lineNumber,
    );
    if (breakpoint == null) {
      reportError('Why are we assigning id to a non-exist breakpoint?');
      return;
    }
    breakpoint.id = breakpointId;
  }

  updateBreakpoint(request: IPCBreakpoint): void {
    const breakpoint = this._findBreakpointOnFileLine(
      request.sourceURL,
      request.lineNumber,
    );
    if (breakpoint != null) {
      this._updateEngineForChanges(breakpoint.request, request);
      breakpoint.request = request;
    } else {
      // In current design, there is a UI race between user sets breakpoint
      // while engine haven't created it yet so this may be expected.
      // Issue an warning instead of error.
      reportWarning(
        'Failed to update breakpoint: the debugger was unable to locate the breakpoint at the specified file and line.',
      );
    }
  }

  _updateEngineForChanges(
    oldRequest: IPCBreakpoint,
    newRequest: IPCBreakpoint,
  ): void {
    const disposition = this._getRequestChangeDisposition(
      oldRequest,
      newRequest,
    );
    switch (disposition) {
      case 'AddBreakpoint':
        this.setFilelineBreakpoint(newRequest);
        break;
      case 'RemoveBreakpoint':
        this._removeBreakpointFromBackend(newRequest);
        break;
      case 'ReplaceBreakpoint':
        this.removeBreakpoint(newRequest);
        this.setFilelineBreakpoint(newRequest);
        break;
      default:
        invariant(disposition === 'NoAction');
        break;
    }
  }

  _getRequestChangeDisposition(
    oldRequest: IPCBreakpoint,
    newRequest: IPCBreakpoint,
  ): BreakpointEngineChangeDisposition {
    if (!oldRequest.enabled && newRequest.enabled) {
      return 'AddBreakpoint';
    } else if (oldRequest.enabled && !newRequest.enabled) {
      return 'RemoveBreakpoint';
    } else if (
      newRequest.enabled &&
      newRequest.condition !== oldRequest.condition
    ) {
      return 'ReplaceBreakpoint';
    } else {
      return 'NoAction';
    }
  }

  removeBreakpoint(request: IPCBreakpoint): void {
    this._removeBreakpointFromBackend(request);
    // Remove from our record list.
    this._removeBreakpointFromList(request);
  }

  _removeBreakpointFromBackend(request: IPCBreakpoint): void {
    const breakpoint = this._findBreakpointOnFileLine(
      request.sourceURL,
      request.lineNumber,
    );
    if (breakpoint != null) {
      // Remove from engine.
      if (this._isConfirmedBreakpoint(breakpoint)) {
        this._debuggerDispatcher.removeBreakpoint(breakpoint.id);
      } else {
        reportError(
          `Cannot removeBreakpoint as it's unverified! ${JSON.stringify(
            breakpoint,
          )}`,
        );
      }
    }
  }

  _removeBreakpointFromList(request: IPCBreakpoint): void {
    const index = this._findBreakpointIndexOnFileLine(
      request.sourceURL,
      request.lineNumber,
    );
    invariant(index !== -1);
    this._breakpointList.splice(index, 1);
  }

  _isConfirmedBreakpoint(breakpoint: UserBreakpoint): boolean {
    return breakpoint.id !== UNCONFIRMED_BREAKPOINT_ID;
  }

  _findBreakpointOnFileLine(sourceUrl: string, line: number): ?UserBreakpoint {
    const index = this._findBreakpointIndexOnFileLine(sourceUrl, line);
    if (index !== -1) {
      return this._breakpointList[index];
    }
    return null;
  }

  _findBreakpointIndexOnFileLine(sourceUrl: string, line: number): number {
    for (const [index, breakpoint] of this._breakpointList.entries()) {
      if (
        breakpoint.request.sourceURL === sourceUrl &&
        breakpoint.request.lineNumber === line
      ) {
        return index;
      }
    }
    return -1;
  }

  _sendBreakpointResolved(
    breakpointId: BreakpointId,
    location: Location,
  ): void {
    const breakpoint = this._getBreakpointFromId(breakpointId);
    if (breakpoint != null) {
      this._raiseIPCEvent('BreakpointRemoved', breakpoint.request);
      this._raiseIPCEvent(
        'BreakpointAdded',
        this._createResolvedBreakpointFromLocation(
          location,
          breakpoint.request.condition,
        ),
      );
      // Update original request's location to the new bound one.
      breakpoint.request.lineNumber = location.lineNumber;
    } else {
      // Some engine(C++) may fire breakpointResolved before setBreakpointByUrl
      // is resolved.
      this._raiseIPCEvent(
        'BreakpointAdded',
        this._createResolvedBreakpointFromLocation(location, ''),
      );
    }
  }

  _sendBreakpointHitCountChanged(
    breakpointId: BreakpointId,
    hitCount: number,
  ): void {
    const breakpoint = this._getBreakpointFromId(breakpointId);
    if (breakpoint != null) {
      this._raiseIPCEvent('BreakpointHitCountChanged', {
        breakpoint: breakpoint.request,
        hitCount,
      });
    }
  }

  _getBreakpointFromId(breakpointId: BreakpointId): ?UserBreakpoint {
    return this._breakpointList.find(bp => bp.id === breakpointId);
  }

  _createResolvedBreakpointFromLocation(
    bpLocation: Location,
    condition: string,
  ): IPCBreakpoint {
    const {scriptId, lineNumber} = bpLocation;
    const sourceURL = this._debuggerDispatcher.getFileUriFromScriptId(scriptId);
    return {
      sourceURL,
      lineNumber,
      condition,
      enabled: true,
      resolved: true,
    };
  }

  handleBreakpointResolved(params: BreakpointResolvedEvent): void {
    const {breakpointId, location} = params;
    if (this._getBreakpointFromId(breakpointId) !== null && location != null) {
      this._sendBreakpointResolved(breakpointId, location);
    } else {
      // User has removed this breakpoint before engine resolves it.
      // This is an expected scenario, just ignore it.
    }
  }

  handleBreakpointHitCountChanged(params: BreakpointHitCountEvent): void {
    const {breakpointId, hitCount} = params;
    if (this._getBreakpointFromId(breakpointId) !== null) {
      this._sendBreakpointHitCountChanged(breakpointId, hitCount);
    } else {
      // User has removed this breakpoint before this message reached the front-end.
      // This is an expected scenario, just ignore it.
    }
  }

  // Not a real IPC event, but simulate the chrome IPC events/responses
  // across bridge boundary.
  _raiseIPCEvent(...args: Array<mixed>): void {
    this._breakpointEvent$.next(args);
  }
}
