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

export type SocketEvent =
  | {type: 'server_started'}
  | {type: 'server_stopping'}
  | {
      type: 'client_connected',
    }
  | {type: 'client_disconnected'}
  | {type: 'data', data: Buffer};

type ServerSocket = {
  clients: Array<net.Socket>,
  server: net.Server,
  observer: rxjs$Observer<SocketEvent>,
};

const socketsForPorts: Map<number, ServerSocket> = new Map();

export function startListening(
  port: number,
): ConnectableObservable<SocketEvent> {
  return Observable.create(observer => {
    if (socketsForPorts.get(port) != null) {
      throw new Error(`Socket on port ${port} already bound`);
    }

    const clients = [];

    const server = net.createServer(socket => {
      clients.push(socket);
      observer.next({type: 'client_connected'});
      socket.on('data', data => {
        observer.next({type: 'data', data});
      });
      socket.on('close', hadError => {
        clients.splice(clients.indexOf(socket), 1);
        observer.next({type: 'client_disconnected'});
      });
      socket.on('error', error => {
        socket.end();
      });
      socket.on('timeout', () => {
        socket.end();
      });
    });
    server.on('error', error => {
      stopListening(port);
      observer.error(error);
    });
    server.maxConnections = 1;
    server.listen({port}, () => {
      observer.next({type: 'server_started'});
    });
    socketsForPorts.set(port, {clients, server, observer});
  }).publish();
}

export function stopListening(port: number): void {
  const openSocket = getOpenSocket(port);
  const {clients, server, observer} = openSocket;
  clients.forEach(client => client.destroy());
  observer.next({type: 'server_stopping'});
  server.close(() => {
    socketsForPorts.delete(port);
    observer.complete();
  });
}

export function writeToClient(port: number, data: Buffer): void {
  const openSocket = getOpenSocket(port);
  if (openSocket.clients.length === 1) {
    openSocket.clients[0].write(data);
  } else {
    openSocket.observer.error(
      `Tried to write on port ${port}, but no client found.`,
    );
  }
}

export function clientError(port: number, error: string): void {
  const openSocket = getOpenSocket(port);
  if (openSocket.clients.length === 1) {
    openSocket.clients[0].destroy(new Error(error));
  } else {
    openSocket.observer.error(
      `Tried to send an error on port ${port}, but no client found.`,
    );
  }
}

export function closeClient(port: number): void {
  const openSocket = getOpenSocket(port);
  if (openSocket.clients.length > 0) {
    openSocket.clients[0].end();
  } else {
    openSocket.observer.error(
      `Tried to close client on port ${port}, but no client found.`,
    );
  }
}

function getOpenSocket(port: number): ServerSocket {
  const openSocket = socketsForPorts.get(port);
  if (openSocket == null) {
    throw new Error(`Server on port ${port} not started`);
  }
  return openSocket;
}
