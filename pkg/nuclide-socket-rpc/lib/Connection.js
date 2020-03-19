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

import type {TunnelHost} from 'nuclide-adb/lib/types';
import type {IRemoteSocket} from './types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getLogger} from 'log4js';
import net from 'net';
import {protocolLogger} from '../../nuclide-server/lib/utils';
import {track} from 'nuclide-analytics';

const PROTOCOL_LOGGER_COUNT = 20;

export class Connection {
  _socket: net.Socket;
  _remoteSocket: IRemoteSocket;
  _disposables: UniversalDisposable;
  _closed: boolean;
  _disposeCalled: boolean;
  _error: ?Error;

  constructor(tunnelHost: TunnelHost, remoteSocket: IRemoteSocket) {
    trace('Connection: creating connection: ' + JSON.stringify(tunnelHost));
    this._closed = false;
    this._disposeCalled = false;
    this._remoteSocket = remoteSocket;
    this._error = null;

    this._socket = net.createConnection(
      {port: tunnelHost.port, family: tunnelHost.family},
      socket => {
        trace('Connection: connection created and ready to write data.');
      },
    );

    this._disposables = new UniversalDisposable(
      () => this._socket.end(),
      this._remoteSocket,
    );

    this._socket.on('error', err => {
      // TODO: we should find a way to send the error back
      //       to the remote socket
      this._error = err;
      getLogger('SocketService').error('Connection error', err);
      this._closed = true;
      this._socket.end();
    });

    this._socket.on('close', () => {
      this.dispose();
    });

    this._socket.on('data', data => {
      if (!this._closed) {
        this._remoteSocket.write(data);
      } else {
        track('socket-service:attempting-to-write-data-after-close', {
          disposeCalled: this._disposeCalled,
          lastError: this._error,
          protocolLog: protocolLogger.dump(PROTOCOL_LOGGER_COUNT),
        });
      }
    });
  }

  write(msg: Buffer): void {
    this._socket.write(msg);
  }

  dispose(): void {
    trace('Connection: disposing connection');
    this._disposeCalled = true;
    this._closed = true;
    this._disposables.dispose();
  }
}

export class ConnectionFactory {
  constructor() {}

  async createConnection(
    tunnelHost: TunnelHost,
    socket: IRemoteSocket,
  ): Promise<Connection> {
    return new Connection(tunnelHost, socket);
  }

  dispose(): void {
    trace('disposing connection.');
  }
}

function trace(message: string) {
  getLogger('SocketService').trace(message);
}
