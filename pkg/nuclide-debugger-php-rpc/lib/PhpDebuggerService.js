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

import logger from './utils';
import {hphpdMightBeAttached} from './helpers';
import {clearConfig, setConfig} from './config';
import {setRootDirectoryUri} from './ConnectionUtils';
import {MessageTranslator} from './MessageTranslator';
import {CompositeDisposable} from 'event-kit';

import type {ConnectableObservable} from 'rxjs';
import type {LogLevel} from '../../nuclide-logging/lib/rpc-types';

export type PhpDebuggerSessionConfig = {
  xdebugAttachPort: number,
  xdebugLaunchingPort: number,
  launchScriptPath?: string,
  pid?: number,
  attachScriptRegex?: string,
  idekeyRegex?: string,
  endDebugWhenNoRequests?: boolean,
  logLevel: LogLevel,
  targetUri: string,
  phpRuntimePath: string,
  phpRuntimeArgs: string,
  dummyRequestFilePath: string,
  stopOneStopAll: boolean,
};

export type NotificationMessage = {
  type: 'info' | 'warning' | 'error' | 'fatalError',
  message: string,
};

// Connection states
const INITIAL = 'initial';
const CONNECTING = 'connecting';
const CONNECTED = 'connected';
const CLOSED = 'closed';

let lastServiceObjectDispose = null;

/**
 * Proxy for converting between Chrome dev tools debugger
 * and HHVM Dbgp debuggee.
 *
 * Chrome Debugging protocol spec is here:
 * https://developer.chrome.com/devtools/docs/protocol/1.1/index
 *
 * Dbgp spec is here:
 * http://xdebug.org/docs-dbgp.php
 *
 * Usage:
 *    Call debug(config) to attach to the dbgp debuggee, or launch a script specified in the config.
 *    After the promise returned by debug() is resolved, call sendCommand() to send Chrome Commands,
 *    and be prepared to receive notifications via the server notifications observable.
 */
import {ClientCallback} from './ClientCallback';
import passesGK from '../../commons-node/passesGK';

const GK_PAUSE_ONE_PAUSE_ALL = 'nuclide_debugger_php_pause_one_pause_all';

export class PhpDebuggerService {
  _state: string;
  _translator: ?MessageTranslator;
  _clientCallback: ClientCallback;
  _disposables: CompositeDisposable;

  constructor() {
    if (lastServiceObjectDispose != null) {
      lastServiceObjectDispose();
    }
    lastServiceObjectDispose = this.dispose.bind(this);
    this._state = INITIAL;
    this._translator = null;
    this._disposables = new CompositeDisposable();
    this._clientCallback = new ClientCallback();
    this._disposables.add(this._clientCallback);
  }

  getNotificationObservable(): ConnectableObservable<NotificationMessage> {
    return this._clientCallback.getNotificationObservable().publish();
  }

  getServerMessageObservable(): ConnectableObservable<string> {
    return this._clientCallback.getServerMessageObservable().publish();
  }

  getOutputWindowObservable(): ConnectableObservable<string> {
    return this._clientCallback.getOutputWindowObservable().publish();
  }

  async debug(config: PhpDebuggerSessionConfig): Promise<string> {
    logger.info('Connecting config: ' + JSON.stringify(config));

    await this._warnIfHphpdAttached();
    if (!await passesGK(GK_PAUSE_ONE_PAUSE_ALL)) {
      config.stopOneStopAll = false;
    }

    setConfig(config);
    await setRootDirectoryUri(config.targetUri);
    logger.setLevel(config.logLevel);
    this._setState(CONNECTING);

    const translator = new MessageTranslator(this._clientCallback);
    this._disposables.add(translator);
    translator.onSessionEnd(() => {
      this._onEnd();
    });
    this._translator = translator;

    this._setState(CONNECTED);

    return 'HHVM connected';
  }

  async sendCommand(message: string): Promise<void> {
    logger.info('Recieved command: ' + message);
    if (this._translator) {
      await this._translator.handleCommand(message);
    }
  }

  async _warnIfHphpdAttached(): Promise<void> {
    const mightBeAttached = await hphpdMightBeAttached();
    if (mightBeAttached) {
      this._clientCallback.sendUserMessage('notification', {
        type: 'warning',
        message: 'You may have an hphpd instance currently attached to your server!' +
          '<br />Please kill it, or the Nuclide debugger may not work properly.',
      });
    }
  }

  _onEnd(): void {
    this._setState(CLOSED);
  }

  _setState(newState: string): void {
    logger.debug('state change from ' + this._state + ' to ' + newState);
    // TODO: Consider logging socket info: remote ip, etc.
    this._state = newState;

    if (this._state === CLOSED) {
      this.dispose();
    }
  }

  dispose(): Promise<void> {
    logger.info('Proxy: Ending session');
    clearConfig();
    this._disposables.dispose();
    return Promise.resolve();
  }
}
