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

import type {ConnectableObservable} from 'rxjs';

import {Observable} from 'rxjs';
import net from 'net';
import {getLogger} from 'log4js';
import {getAvailableServerPort as _getAvailableServerPort} from '../../commons-node/serverPort';

export type SocketEvent =
  | {type: 'server_started'}
  | {type: 'server_stopping'}
  | {
      type: 'client_connected',
      clientPort: number,
    }
  | {type: 'client_disconnected', clientPort: number}
  | {type: 'data', clientPort: number, data: Buffer};

type ServerSocket = {
  clients: Map<number, net.Socket>,
  server: net.Server,
  observer: rxjs$Observer<SocketEvent>,
};

const serverSockets: Map<number, ServerSocket> = new Map();

export function startListening(
  serverPort: number,
  family: 4 | 6 = 6,
): ConnectableObservable<SocketEvent> {
  return Observable.create(observer => {
    trace(`rpc: start server (server: ${serverPort})`);
    if (serverSockets.get(serverPort) != null) {
      observer.error(new Error(`Socket on port ${serverPort} already bound`));
      return;
    }

    const clients = new Map();

    const server = net.createServer(clientSocket => {
      const clientPort = clientSocket.remotePort;
      trace(`client: connect (server: ${serverPort}, client: ${clientPort})`);
      clients.set(clientPort, clientSocket);
      observer.next({type: 'client_connected', clientPort});
      clientSocket.on('data', data => {
        observer.next({type: 'data', clientPort, data});
      });
      clientSocket.on('close', hadError => {
        trace(`client: close (server: ${serverPort}, client: ${clientPort})`);
        clients.delete(clientPort);
        observer.next({type: 'client_disconnected', clientPort});
      });
      clientSocket.on('error', error => {
        trace(
          `client: error (server: ${serverPort}, client: ${clientPort}): ${error}`,
        );
        clientSocket.end();
      });
      clientSocket.on('timeout', () => {
        trace(`client: timeout (server: ${serverPort}, client: ${clientPort})`);
        clientSocket.end();
      });
    });
    server.on('error', error => {
      _stopListening(serverPort);
      observer.error(error);
    });
    server.listen(
      {host: family === 6 ? '::' : '0.0.0.0', port: serverPort},
      () => {
        observer.next({type: 'server_started'});
      },
    );
    serverSockets.set(serverPort, {clients, server, observer});
  }).publish();
}

export function stopListening(serverPort: number): void {
  trace(`rpc: stop server (server: ${serverPort})`);
  _stopListening(serverPort);
}

function _stopListening(serverPort: number): void {
  const serverSocket = getServerSocket(serverPort);
  const {clients, server, observer} = serverSocket;
  clients.forEach(client => client.destroy());
  observer.next({type: 'server_stopping'});
  server.close(() => {
    serverSockets.delete(serverPort);
    observer.complete();
  });
}

export function writeToClient(
  serverPort: number,
  clientPort: number,
  data: Buffer,
): void {
  const serverSocket = getServerSocket(serverPort);
  const clientSocket = serverSocket.clients.get(clientPort);
  if (clientSocket != null) {
    clientSocket.write(data);
  }
}

export function clientError(
  serverPort: number,
  clientPort: number,
  error: string,
): void {
  const serverSocket = getServerSocket(serverPort);
  const clientSocket = serverSocket.clients.get(clientPort);
  trace(
    `rpc: client error (server: ${serverPort}, client: ${clientPort}): ${error}`,
  );
  if (clientSocket != null) {
    clientSocket.destroy(new Error(error));
  }
}

export function closeClient(serverPort: number, clientPort: number): void {
  trace(`rpc: close client (server: ${serverPort}, client: ${clientPort})`);
  const serverSocket = getServerSocket(serverPort);
  const clientSocket = serverSocket.clients.get(clientPort);
  if (clientSocket != null) {
    clientSocket.end();
  }
}

function getServerSocket(serverPort: number): ServerSocket {
  const socket = serverSockets.get(serverPort);
  if (socket == null) {
    throw new Error(`Server on port ${serverPort} not started`);
  }
  return socket;
}

function trace(message: string) {
  getLogger('SocketService').trace(message);
}

export async function getAvailableServerPort(): Promise<number> {
  return _getAvailableServerPort();
}
