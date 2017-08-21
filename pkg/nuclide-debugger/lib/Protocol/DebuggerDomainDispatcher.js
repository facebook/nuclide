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
import type {IPCBreakpoint, ObjectGroup} from '../types';
import type {
  ScriptId,
  BreakpointId,
  DebuggerEvent,
  BreakpointHitCountEvent,
  BreakpointResolvedEvent,
  ThreadsUpdatedEvent,
  ThreadUpdatedEvent,
  PausedEvent,
  ScriptParsedEvent,
  Location,
  CallFrameId,
  SetDebuggerSettingsRequest,
  SetPauseOnExceptionsRequest,
} from '../../../nuclide-debugger-base/lib/protocol-types';

import {Subject, Observable} from 'rxjs';
import nuclideUri from 'nuclide-commons/nuclideUri';

type LoaderBreakpointEvent = {
  method: 'Debugger.loaderBreakpoint',
  params: PausedEvent,
};

export type ProtocolDebugEvent = DebuggerEvent | LoaderBreakpointEvent;

/**
 * Responsible for sending and receiving debugger domain protocols from
 * debug engine.
 */
class DebuggerDomainDispatcher {
  _agent: Object; // debugger agent from chrome protocol.
  _parsedFiles: Map<ScriptId, NuclideUri>;
  _debugEvent$: Subject<ProtocolDebugEvent>;
  _pauseCount: number;

  constructor(agent: Object) {
    this._agent = agent;
    this._parsedFiles = new Map();
    this._debugEvent$ = new Subject();
    this._pauseCount = 0;
  }

  setDebuggerSettings(settings: SetDebuggerSettingsRequest): void {
    this._agent.setDebuggerSettings(settings.singleThreadStepping);
  }

  getSourceUriFromUri(fileUri: NuclideUri): ?ScriptId {
    for (const uri of this._parsedFiles.values()) {
      // Strip file:// from the uri.
      const strippedUri = nuclideUri.uriToNuclideUri(uri) || uri;
      if (strippedUri === fileUri) {
        return uri;
      }
    }
    return null;
  }

  getScriptIdFromUri(fileUri: NuclideUri): ?ScriptId {
    for (const [scriptId, uri] of this._parsedFiles) {
      // Strip file:// from the uri.
      const strippedUri = nuclideUri.uriToNuclideUri(uri) || uri;
      if (strippedUri === fileUri) {
        return scriptId;
      }
    }
    return null;
  }

  enable(): void {
    this._agent.enable();
  }

  resume(): void {
    this._agent.resume();
  }

  pause(): void {
    this._agent.pause();
  }

  stepOver(): void {
    this._agent.stepOver();
  }

  stepInto(): void {
    this._agent.stepInto();
  }

  stepOut(): void {
    this._agent.stepOut();
  }

  continueToLocation(location: Location): void {
    this._agent.continueToLocation(location);
  }

  setPauseOnExceptions(request: SetPauseOnExceptionsRequest): void {
    this._agent.setPauseOnExceptions(request.state);
  }

  setBreakpointByUrl(breakpoint: IPCBreakpoint, callback: Function): void {
    this._agent.setBreakpointByUrl(
      breakpoint.lineNumber,
      breakpoint.sourceURL,
      undefined, // urlRegex. Not used.
      0, // column. Not used yet.
      breakpoint.condition,
      callback,
    );
  }

  removeBreakpoint(breakpointId: BreakpointId): void {
    this._agent.removeBreakpoint(breakpointId);
  }

  evaluateOnCallFrame(
    callFrameId: CallFrameId,
    expression: string,
    objectGroup: ObjectGroup,
    callback: Function,
  ): void {
    this._agent.evaluateOnCallFrame(
      callFrameId,
      expression,
      objectGroup,
      undefined, // includeCommandLineAPI
      undefined, // silent
      undefined, // returnByValue
      undefined, // generatePreview
      callback,
    );
  }

  selectThread(threadId: number): void {
    this._agent.selectThread(threadId);
  }

  getThreadStack(threadId: number, callback: Function): void {
    this._agent.getThreadStack(threadId, callback);
  }

  getEventObservable(): Observable<ProtocolDebugEvent> {
    return this._debugEvent$.asObservable();
  }

  paused(params: PausedEvent): void {
    ++this._pauseCount;
    // Convert the first Debugger.paused to Debugger.loaderBreakpoint.
    if (this._pauseCount === 1) {
      this._raiseProtocolEvent({
        method: 'Debugger.loaderBreakpoint',
        params,
      });
    } else {
      this._raiseProtocolEvent({
        method: 'Debugger.paused',
        params,
      });
    }
  }

  resumed(): void {
    this._raiseProtocolEvent({
      method: 'Debugger.resumed',
    });
  }

  threadsUpdated(params: ThreadsUpdatedEvent): void {
    this._raiseProtocolEvent({
      method: 'Debugger.threadsUpdated',
      params,
    });
  }

  threadUpdated(params: ThreadUpdatedEvent): void {
    this._raiseProtocolEvent({
      method: 'Debugger.threadUpdated',
      params,
    });
  }

  breakpointResolved(params: BreakpointResolvedEvent): void {
    this._raiseProtocolEvent({
      method: 'Debugger.breakpointResolved',
      params,
    });
  }

  breakpointHitCountChanged(params: BreakpointHitCountEvent): void {
    this._raiseProtocolEvent({
      method: 'Debugger.breakpointHitCountChanged',
      params,
    });
  }

  scriptParsed(params: ScriptParsedEvent): void {
    this._parsedFiles.set(params.scriptId, params.url);
  }

  getFileUriFromScriptId(scriptId: ScriptId): NuclideUri {
    // Fallback to treat scriptId as url. Some engines(like MobileJS) uses
    // scriptId as file url.
    return this._parsedFiles.get(scriptId) || scriptId;
  }

  _raiseProtocolEvent(event: ProtocolDebugEvent): void {
    this._debugEvent$.next(event);
  }
}

// Use old school export to allow legacy code to import it.
module.exports = DebuggerDomainDispatcher; // eslint-disable-line nuclide-internal/no-commonjs
