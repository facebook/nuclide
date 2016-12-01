'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type DebuggerModel from './DebuggerModel';
import type {
  Callstack,
  EvalCommand,
  ExpansionResult,
  NuclideThreadData,
  ThreadItem,
  BreakpointUserChangeArgType,
  IPCBreakpoint,
  ExpressionResult,
  GetPropertiesResult,
} from './types';

import {CompositeDisposable, Disposable} from 'atom';
import nuclideUri from '../../commons-node/nuclideUri';
import {DebuggerMode} from './DebuggerStore';

const INJECTED_CSS = [
  /* Force the inspector to scroll vertically on Atom ≥ 1.4.0 */
  'body > .root-view {overflow-y: scroll;}',
  /* Force the contents of the mini console (on the bottom) to scroll vertically */
  '.insertion-point-sidebar#drawer-contents {overflow-y: auto;}',
  /* imitate chrome table styles for threads window */
  `
  .nuclide-chrome-debugger-data-grid table {
    border-spacing: 0;
  }

  .nuclide-chrome-debugger-data-grid thead {
    background-color: #eee;
  }

  .nuclide-chrome-debugger-data-grid thead td {
    border-bottom: 1px solid #aaa;
  }

  .nuclide-chrome-debugger-data-grid tbody tr:nth-child(2n+1) {
    background: aliceblue;
  }

  .nuclide-chrome-debugger-data-grid td {
    border-left: 1px solid #aaa;
    padding: 2px 4px;
  }

  .nuclide-chrome-debugger-data-grid td:first-child {
    border-left: none;
  }
  `,
].join('');

class Bridge {
  _debuggerModel: DebuggerModel;
  _disposables: CompositeDisposable;
  // Contains disposable items should be disposed by
  // cleanup() method.
  _cleanupDisposables: CompositeDisposable;
  _webview: ?WebviewElement;
  _suppressBreakpointSync: boolean;

  constructor(debuggerModel: DebuggerModel) {
    this._debuggerModel = debuggerModel;
    this._cleanupDisposables = new CompositeDisposable();
    this._webview = null;
    this._suppressBreakpointSync = false;
    this._disposables = new CompositeDisposable(
      debuggerModel.getBreakpointStore().onUserChange(this._handleUserBreakpointChange.bind(this)),
    );
  }

  setWebviewElement(webview: WebviewElement) {
    this._webview = webview;
    const boundHandler = this._handleIpcMessage.bind(this);
    webview.addEventListener('ipc-message', boundHandler);
    this._cleanupDisposables.add(new Disposable(() =>
      webview.removeEventListener('ipc-message', boundHandler)));
  }

  dispose() {
    this.cleanup();
    this._disposables.dispose();
  }

  // Clean up any state changed after constructor.
  cleanup() {
    this._cleanupDisposables.dispose();
    this._webview = null;
    // Poor man's `waitFor` to prevent nested dispatch. Actual `waitsFor` requires passing around
    // dispatch tokens between unrelated stores, which is quite cumbersome.
    // TODO @jxg move to redux to eliminate this problem altogether.
    setTimeout(() => {
      this._debuggerModel.getActions().clearInterface();
    });
  }

  continue() {
    if (this._webview) {
      this._webview.send('command', 'Continue');
    }
  }

  stepOver() {
    if (this._webview) {
      this._webview.send('command', 'StepOver');
    }
  }

  stepInto() {
    if (this._webview) {
      this._webview.send('command', 'StepInto');
    }
  }

  stepOut() {
    if (this._webview) {
      this._webview.send('command', 'StepOut');
    }
  }

  runToLocation(filePath: string, line: number) {
    if (this._webview) {
      this._webview.send(
        'command',
        'RunToLocation',
        filePath,
        line,
      );
    }
  }

  triggerAction(actionId: string): void {
    if (this._webview) {
      this._webview.send(
        'command',
        'triggerDebuggerAction',
        actionId,
      );
    }
  }

  setSelectedCallFrameIndex(callFrameIndex: number): void {
    if (this._webview != null) {
      this._webview.send(
        'command',
        'setSelectedCallFrameIndex',
        callFrameIndex,
      );
    }
  }

  setPauseOnException(pauseOnExceptionEnabled: boolean): void {
    if (this._webview) {
      this._webview.send(
        'command',
        'setPauseOnException',
        pauseOnExceptionEnabled,
      );
    }
  }

  setPauseOnCaughtException(pauseOnCaughtExceptionEnabled: boolean): void {
    if (this._webview) {
      this._webview.send(
        'command',
        'setPauseOnCaughtException',
        pauseOnCaughtExceptionEnabled,
      );
    }
  }

  setSingleThreadStepping(singleThreadStepping: boolean): void {
    if (this._webview) {
      this._webview.send(
        'command',
        'setSingleThreadStepping',
        singleThreadStepping,
      );
    }
  }

  selectThread(threadId: string): void {
    if (this._webview) {
      this._webview.send(
        'command',
        'selectThread',
        threadId,
      );
    }
  }

  sendEvaluationCommand(
    command: EvalCommand,
    evalId: number,
    ...args: Array<mixed>
  ): void {
    if (this._webview != null) {
      this._webview.send('command', command, evalId, ...args);
    }
  }

  _handleExpressionEvaluationResponse(response: ExpressionResult & {id: number}): void {
    this._debuggerModel.getActions().receiveExpressionEvaluationResponse(response.id, response);
  }

  _handleGetPropertiesResponse(response: GetPropertiesResult & {id: number}): void {
    this._debuggerModel.getActions().receiveGetPropertiesResponse(response.id, response);
  }

  _handleCallstackUpdate(callstack: Callstack): void {
    this._debuggerModel.getActions().updateCallstack(callstack);
  }

  _handleLocalsUpdate(locals: ExpansionResult): void {
    this._debuggerModel.getActions().updateLocals(locals);
  }

  _handleIpcMessage(stdEvent: Event): void {
    // addEventListener expects its callback to take an Event. I'm not sure how to reconcile it with
    // the type that is expected here.
    // $FlowFixMe(jeffreytan)
    const event: {channel: string, args: any[]} = stdEvent;
    switch (event.channel) {
      case 'notification':
        switch (event.args[0]) {
          case 'ready':
            this._updateDebuggerSettings();
            this._sendAllBreakpoints();
            this._injectCSS();
            this._syncDebuggerState();
            break;
          case 'CallFrameSelected':
            this._setSelectedCallFrameLine(event.args[1]);
            break;
          case 'OpenSourceLocation':
            this._openSourceLocation(event.args[1]);
            break;
          case 'ClearInterface':
            this._handleClearInterface();
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
            this._bindBreakpoint(event.args[1]);
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
          case 'LocalsUpdate':
            this._handleLocalsUpdate(event.args[1]);
            break;
          case 'ThreadsUpdate':
            this._handleThreadsUpdate(event.args[1]);
            break;
          case 'ThreadUpdate':
            this._handleThreadUpdate(event.args[1]);
            break;
        }
        break;
    }
  }

  _updateDebuggerSettings(): void {
    const webview = this._webview;
    if (webview != null) {
      webview.send(
        'command',
        'UpdateSettings',
        this._debuggerModel.getStore().getSettings().getSerializedData(),
      );
    }
  }

  _syncDebuggerState(): void {
    const store = this._debuggerModel.getStore();
    this.setPauseOnException(store.getTogglePauseOnException());
    this.setPauseOnCaughtException(store.getTogglePauseOnCaughtException());
    this.setSingleThreadStepping(store.getEnableSingleThreadStepping());
  }

  _handleDebuggerPaused(options: ?{
    stopThreadId: number,
    threadSwitchNotification: {sourceURL: string, lineNumber: number, message: string},
  }): void {
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

  _handleClearInterface(): void {
    this._debuggerModel.getActions().clearInterface();
  }

  _setSelectedCallFrameLine(options: ?{sourceURL: string, lineNumber: number}): void {
    this._debuggerModel.getActions().setSelectedCallFrameLine(options);
  }

  _openSourceLocation(options: ?{sourceURL: string, lineNumber: number}): void {
    if (options == null) {
      return;
    }
    this._debuggerModel.getActions().openSourceLocation(
      options.sourceURL,
      options.lineNumber,
    );
  }

  _handleStopThreadSwitch(options: ?{sourceURL: string, lineNumber: number, message: string}) {
    if (options == null) {
      return;
    }
    this._debuggerModel.getActions().notifyThreadSwitch(
      options.sourceURL,
      options.lineNumber,
      options.message,
    );
  }

  _bindBreakpoint(breakpoint: IPCBreakpoint) {
    const {sourceURL, lineNumber, condition, enabled} = breakpoint;
    const path = nuclideUri.uriToNuclideUri(sourceURL);
    // only handle real files for now.
    if (path) {
      try {
        this._suppressBreakpointSync = true;
        this._debuggerModel.getActions().bindBreakpointIPC(path, lineNumber, condition, enabled);
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
    const webview = this._webview;
    if (webview != null) {
      const {action, breakpoint} = params;
      webview.send('command', action, {
        sourceURL: nuclideUri.nuclideUriToUri(breakpoint.path),
        lineNumber: breakpoint.line,
        condition: breakpoint.condition,
        enabled: breakpoint.enabled,
      });
    }
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
    const webview = this._webview;
    if (webview && !this._suppressBreakpointSync) {
      const results = [];
      this._debuggerModel.getBreakpointStore().getAllBreakpoints().forEach(breakpoint => {
        results.push({
          sourceURL: nuclideUri.nuclideUriToUri(breakpoint.path),
          lineNumber: breakpoint.line,
          condition: breakpoint.condition,
          enabled: breakpoint.enabled,
        });
      });
      webview.send('command', 'SyncBreakpoints', results);
    }
  }

  _injectCSS() {
    if (this._webview != null) {
      this._webview.insertCSS(INJECTED_CSS);
    }
  }

}

module.exports = Bridge;
