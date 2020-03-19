/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import invariant from 'assert';
import fs from 'fs';
import {getLogger} from 'log4js';
import {Deferred} from 'nuclide-commons/promise';
import {getOutputStream, ProcessExitError} from 'nuclide-commons/process';
import {Observable} from 'rxjs';
import {StreamTransport} from '../../nuclide-rpc';

const PIPE_FD = 3;
const NUCLIDE_E2E_TEST = 'NUCLIDE_E2E_TEST';

export class IpcServerTransport {
  _transport: StreamTransport;

  constructor() {
    this._transport = new StreamTransport(
      fs.createWriteStream('', {fd: PIPE_FD}),
      fs.createReadStream('', {fd: PIPE_FD}),
    );
  }

  send(message: string): void {
    this._transport.send(message);
  }

  onMessage(): Observable<string> {
    return this._transport.onMessage();
  }

  close(): void {
    this._transport.close();
  }

  isClosed(): boolean {
    return this._transport.isClosed();
  }
}

export class IpcClientTransport {
  _transport: Deferred<StreamTransport>;
  _subscription: rxjs$Subscription;

  constructor(processStream: Observable<child_process$ChildProcess>) {
    this._transport = new Deferred();
    this._subscription = processStream
      .do(process =>
        this._transport.resolve(
          new StreamTransport(process.stdio[PIPE_FD], process.stdio[PIPE_FD]),
        ),
      )
      .switchMap(process => getOutputStream(process))
      .do(message => {
        if (process.env[NUCLIDE_E2E_TEST] != null) {
          if (
            message &&
            (message.kind === 'stdout' || message.kind === 'stderr')
          ) {
            // eslint-disable-next-line no-console
            console.log(`[IPC ${message.kind}]`, message.data);
          }
        }
      })
      .subscribe({
        error: err => {
          this._handleError(err);
        },
      });
  }

  _handleError(err: Error) {
    this._transport.reject(err);
    getLogger().fatal('Nuclide RPC process crashed', err);
    const buttons = [
      {
        text: 'Reload Atom',
        className: 'icon icon-zap',
        onDidClick() {
          atom.reload();
        },
      },
    ];
    if (atom.packages.isPackageLoaded('fb-file-a-bug')) {
      buttons.push({
        text: 'File a bug',
        className: 'icon icon-nuclicon-bug',
        onDidClick() {
          atom.commands.dispatch(
            atom.workspace.getElement(),
            'fb-file-a-bug:file',
          );
        },
      });
    }
    let detail;
    if (err instanceof ProcessExitError) {
      let {stderr} = err;
      if (stderr != null) {
        const lines = stderr.split('\n');
        const startIndex = lines.findIndex(line =>
          line.includes('chrome-devtools://'),
        );
        if (startIndex !== -1) {
          stderr = lines.slice(startIndex + 1).join('\n');
        }
      }
      detail = `Exit code: ${String(err.exitCode)}\nstderr: ${stderr}`;
    } else {
      detail = String(err);
    }
    atom.notifications.addError('Local RPC process crashed!', {
      description:
        'The local Nuclide RPC process crashed. Please reload Atom to continue.',
      detail,
      dismissable: true,
      buttons,
    });
  }

  send(message: string): void {
    invariant(!this.isClosed(), 'Transport unexpectedly closed');
    this._transport.promise.then(transport => {
      transport.send(message);
    });
  }

  onMessage(): Observable<string> {
    return Observable.fromPromise(this._transport.promise).switchMap(
      transport => transport.onMessage(),
    );
  }

  close() {
    this._subscription.unsubscribe();
    this._transport.reject(Error('Transport closed'));
  }

  isClosed(): boolean {
    // $FlowFixMe: Add to rxjs defs
    return this._subscription.closed;
  }
}
