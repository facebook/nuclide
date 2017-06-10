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

import type {IPCEvent} from './types';

require('./Protocol/Object');
import InspectorBackendClass from './Protocol/NuclideProtocolParser';

import invariant from 'assert';
import {Observable} from 'rxjs';
import BridgeAdapter from './Protocol/BridgeAdapter';
import {
  isNewProtocolChannelEnabled,
} from '../../nuclide-debugger-common/lib/NewProtocolChannelChecker';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {reportError} from './Protocol/EventReporter';

/**
  * Class that dispatches Nuclide commands to debugger engine.
  * This is used to abstract away the underlying implementation for command dispatching
  * and allows us to switch between chrome IPC and new non-chrome channel.
  */
export default class CommandDispatcher {
  _sessionSubscriptions: ?UniversalDisposable;
  _webview: ?WebviewElement;
  _webviewUrl: ?string;
  _bridgeAdapter: ?BridgeAdapter;
  _useNewChannel: boolean;

  constructor() {
    this._useNewChannel = false;
  }

  isNewChannel(): boolean {
    return this._useNewChannel;
  }

  setupChromeChannel(url: string): void {
    this._ensureSessionCreated();
    // Do not bother setup load if new channel is enabled.
    if (this._useNewChannel) {
      invariant(this._bridgeAdapter != null);
      this._bridgeAdapter.enable();
      return;
    }
    if (this._webview == null) {
      // Cast from HTMLElement down to WebviewElement without instanceof
      // checking, as WebviewElement constructor is not exposed.
      const webview = ((document.createElement(
        'webview',
      ): any): WebviewElement);
      webview.src = url;
      webview.nodeintegration = true;
      webview.disablewebsecurity = true;
      webview.classList.add('native-key-bindings'); // required to pass through certain key events
      webview.classList.add('nuclide-debugger-webview');

      // The webview is actually only used for its state; it's really more of a model that just has
      // to live in the DOM. We render it into the body to keep it separate from our view, which may
      // be detached. If the webview were a child, it would cause the webview to reload when
      // reattached, and we'd lose our state.
      invariant(document.body != null);
      document.body.appendChild(webview);

      this._webview = webview;
      invariant(this._sessionSubscriptions != null);
      this._sessionSubscriptions.add(() => {
        webview.remove();
        this._webview = null;
        this._webviewUrl = null;
      });
    } else if (url !== this._webviewUrl) {
      this._webview.src = url;
    }
    this._webviewUrl = url;
  }

  async setupNuclideChannel(debuggerInstance: Object): Promise<void> {
    this._ensureSessionCreated();
    this._useNewChannel = await isNewProtocolChannelEnabled();
    if (this._useNewChannel) {
      const dispatchers = await InspectorBackendClass.bootstrap(
        debuggerInstance,
      );
      this._bridgeAdapter = new BridgeAdapter(dispatchers);
      invariant(this._sessionSubscriptions != null);
      this._sessionSubscriptions.add(() => {
        if (this._bridgeAdapter != null) {
          this._bridgeAdapter.dispose();
          this._bridgeAdapter = null;
        }
      });
    }
  }

  _ensureSessionCreated(): void {
    if (this._sessionSubscriptions == null) {
      this._sessionSubscriptions = new UniversalDisposable();
    }
  }

  cleanupSessionState(): void {
    if (this._sessionSubscriptions != null) {
      this._sessionSubscriptions.dispose();
      this._sessionSubscriptions = null;
    }
  }

  send(...args: Array<any>): void {
    if (this._useNewChannel) {
      this._sendViaNuclideChannel(...args);
    } else {
      this._sendViaChromeChannel(...args);
    }
  }

  openDevTools(): void {
    if (this._webview == null) {
      return;
    }
    this._webview.openDevTools();
  }

  getEventObservable(): Observable<IPCEvent> {
    if (this._useNewChannel) {
      invariant(this._bridgeAdapter != null);
      return this._bridgeAdapter.getEventObservable();
    } else {
      invariant(this._webview != null);
      return Observable.fromEvent(this._webview, 'ipc-message');
    }
  }

  _sendViaNuclideChannel(...args: Array<any>): void {
    invariant(this._bridgeAdapter != null);
    switch (args[0]) {
      case 'Continue':
        this._bridgeAdapter.resume();
        break;
      case 'Pause':
        this._bridgeAdapter.pause();
        break;
      case 'StepOver':
        this._bridgeAdapter.stepOver();
        break;
      case 'StepInto':
        this._bridgeAdapter.stepInto();
        break;
      case 'StepOut':
        this._bridgeAdapter.stepOut();
        break;
      case 'RunToLocation':
        this._bridgeAdapter.runToLocation(args[1], args[2]);
        break;
      case 'triggerDebuggerAction':
        this._triggerDebuggerAction(args[1]);
        break;
      case 'SyncBreakpoints':
        this._bridgeAdapter.setInitialBreakpoints(args[1]);
        break;
      case 'AddBreakpoint':
        this._bridgeAdapter.setFilelineBreakpoint(args[1]);
        break;
      case 'DeleteBreakpoint':
        this._bridgeAdapter.removeBreakpoint(args[1]);
        break;
      case 'UpdateBreakpoint':
        this._bridgeAdapter.updateBreakpoint(args[1]);
        break;
      case 'setSelectedCallFrameIndex':
        this._bridgeAdapter.setSelectedCallFrameIndex(args[1]);
        break;
      case 'evaluateOnSelectedCallFrame':
        this._bridgeAdapter.evaluateExpression(args[1], args[2], args[3]);
        break;
      case 'runtimeEvaluate':
        this._bridgeAdapter.evaluateExpression(args[1], args[2], 'console');
        break;
      case 'getProperties':
        this._bridgeAdapter.getProperties(args[1], args[2]);
        break;
      case 'selectThread':
        this._bridgeAdapter.selectThread(args[1]);
        break;
      case 'setPauseOnException':
        this._bridgeAdapter.setPauseOnException(args[1]);
        break;
      case 'setPauseOnCaughtException':
        this._bridgeAdapter.setPauseOnCaughtException(args[1]);
        break;
      case 'setSingleThreadStepping':
        this._bridgeAdapter.setSingleThreadStepping(args[1]);
        break;
      default:
        reportError(`Command ${args[0]} is not implemented yet.`);
        break;
    }
  }

  _triggerDebuggerAction(actionId: string): void {
    invariant(this._bridgeAdapter != null);
    switch (actionId) {
      case 'debugger.toggle-pause':
        // TODO[jetan]: 'debugger.toggle-pause' needs to implement state management which
        // I haven't think well yet so forward to chrome for now.
        this._sendViaChromeChannel(
          'triggerDebuggerAction',
          'debugger.toggle-pause',
        );
        break;
      case 'debugger.step-over':
        this._bridgeAdapter.stepOver();
        break;
      case 'debugger.step-into':
        this._bridgeAdapter.stepInto();
        break;
      case 'debugger.step-out':
        this._bridgeAdapter.stepOut();
        break;
      case 'debugger.run-snippet':
        this._bridgeAdapter.resume();
        break;
      default:
        throw Error(
          `_triggerDebuggerAction: unrecognized actionId: ${actionId}`,
        );
    }
  }

  _sendViaChromeChannel(...args: Array<any>): void {
    const webview = this._webview;
    if (webview != null) {
      webview.send('command', ...args);
    } else {
      // TODO: log and throw error.
    }
  }
}
