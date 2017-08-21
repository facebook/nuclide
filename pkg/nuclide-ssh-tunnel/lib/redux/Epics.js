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

const socketsForTunnels: Map<Tunnel, net.Socket> = new Map();

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
    const remoteEvents = remoteService.startListening(from.port);
    const subscription = remoteEvents.subscribe({
      next: event => {
        let socket = socketsForTunnels.get(tunnel);
        if (event.type === 'server_started') {
          store.dispatch(Actions.setTunnelState(tunnel, 'ready'));
          onOpen();
        } else if (event.type === 'client_connected') {
          invariant(socket == null);
          socket = net.createConnection(
            {
              port: to.port,
              family: 6,
            },
            () => store.dispatch(Actions.setTunnelState(tunnel, 'active')),
          );
          socket.on('end', () => {
            socketsForTunnels.delete(tunnel);
            store.dispatch(Actions.setTunnelState(tunnel, 'ready'));
          });
          socket.on('timeout', () => {
            invariant(socket);
            socket.end();
          });
          socket.on('error', error => {
            remoteService.clientError(from.port, error.toString());
          });
          socket.on('data', data => {
            remoteService.writeToClient(from.port, data);
          });
          socket.on('close', () => {
            invariant(socket != null);
            remoteService.closeClient(from.port);
            socket.end();
          });
          socketsForTunnels.set(tunnel, socket);
        } else if (event.type === 'client_disconnected') {
          if (socket != null) {
            socket.end();
          }
        } else if (event.type === 'data') {
          invariant(socket != null);
          socket.write(event.data);
        }
      },
      error: error => store.dispatch(Actions.closeTunnel(tunnel, error)),
    });
    remoteEvents.connect();
    return Actions.addOpenTunnel(tunnel, error => {
      const socket = socketsForTunnels.get(tunnel);
      if (socket != null) {
        socket.destroy();
      }
      remoteService.stopListening(from.port);
      subscription.unsubscribe();
      onClose(error);
    });
  });
}
