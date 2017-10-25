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

import type {ActionsObservable} from 'nuclide-commons/redux-observable';
import type {Action, Store, Tunnel} from '../types';

import * as Actions from './Actions';
import {Observable} from 'rxjs';
import invariant from 'assert';
import {getSocketServiceByNuclideUri} from '../../../nuclide-remote-connection/';
import net from 'net';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getLogger} from 'log4js';

const clientConnections: Map<Tunnel, Map<number, net.Socket>> = new Map();

export function openTunnelEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.OPEN_TUNNEL).map(action => {
    invariant(action.type === Actions.OPEN_TUNNEL);
    const {tunnel, onOpen, onClose} = action.payload;
    const {from, to} = tunnel;
    const fromUri = nuclideUri.createRemoteUri(from.host, '/');
    const remoteService = getSocketServiceByNuclideUri(fromUri);
    const remoteEvents = remoteService.startListening(from.port, from.family);
    const subscription = remoteEvents.subscribe({
      next: event => {
        const clients = clientConnections.get(tunnel);
        invariant(clients);
        if (event.type === 'server_started') {
          store.dispatch(Actions.setTunnelState(tunnel, 'ready'));
          onOpen();
        } else if (event.type === 'client_connected') {
          const {clientPort} = event;
          invariant(clients.get(clientPort) == null);
          const socket = net.createConnection(
            {
              port: to.port,
              family: to.family || 6,
            },
            () => store.dispatch(Actions.setTunnelState(tunnel, 'active')),
          );
          socket.on('end', () => {
            trace(
              `client: end (port: ${clientPort}, ${tunnelDescription(tunnel)})`,
            );
            clients.delete(clientPort);
            store.dispatch(Actions.setTunnelState(tunnel, 'ready'));
          });
          socket.on('timeout', () => {
            trace(
              `client: timeout (port: ${clientPort}, ${tunnelDescription(
                tunnel,
              )})`,
            );
            invariant(socket);
            socket.end();
          });
          socket.on('error', error => {
            trace(
              `client: error (port: ${clientPort}, ${tunnelDescription(
                tunnel,
              )})`,
            );
            remoteService.clientError(from.port, clientPort, error.toString());
          });
          socket.on('data', data => {
            remoteService.writeToClient(from.port, clientPort, data);
          });
          socket.on('close', () => {
            invariant(socket != null);
            trace(
              `client: close (port: ${clientPort}, ${tunnelDescription(
                tunnel,
              )})`,
            );
            remoteService.closeClient(from.port, clientPort);
            socket.end();
          });
          clients.set(clientPort, socket);
        } else if (event.type === 'client_disconnected') {
          const {clientPort} = event;
          const socket = clients.get(clientPort);
          if (socket != null) {
            socket.end();
          }
        } else if (event.type === 'data') {
          const {clientPort} = event;
          const socket = clients.get(clientPort);
          invariant(socket != null);
          socket.write(event.data);
        }
      },
      error: error => {
        getLogger('nuclide-ssh-tunnel').error(
          `tunnel: error (${tunnelDescription(tunnel)}): ${error}`,
        );
        store.dispatch(Actions.closeTunnel(tunnel, error));
      },
    });
    clientConnections.set(tunnel, new Map());
    remoteEvents.connect();
    return Actions.addOpenTunnel(tunnel, error => {
      const sockets = clientConnections.get(tunnel);
      invariant(sockets);
      for (const socket of sockets.values()) {
        socket.destroy();
      }
      remoteService.stopListening(from.port);
      subscription.unsubscribe();
      clientConnections.delete(tunnel);
      onClose(error);
    });
  });
}

function trace(message: string) {
  getLogger('nuclide-ssh-tunnel').trace(message);
}

function tunnelDescription(tunnel: Tunnel): string {
  return `${tunnel.from.host}:${tunnel.from.port}->${tunnel.to.host}:${tunnel.to
    .port}`;
}
