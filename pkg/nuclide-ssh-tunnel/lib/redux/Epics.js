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
import type {Action, Store} from '../types';

import {getSocketServiceByHost} from '../Normalization';
import * as Actions from './Actions';
import {Observable} from 'rxjs';
import {getLogger} from 'log4js';
import invariant from 'assert';
import {tunnelDescription} from '../../../nuclide-socket-rpc/lib/Tunnel';
import {getBigDigClientByNuclideUri} from '../../../nuclide-remote-connection';
import passesGK from 'nuclide-commons/passesGK';

const logger = getLogger('nuclide-ssh-tunnel');

export function subscribeToTunnelEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.SUBSCRIBE_TO_TUNNEL)
    .mergeMap(async action => {
      invariant(action.type === Actions.SUBSCRIBE_TO_TUNNEL);
      const {onOpen, subscription, tunnel} = action.payload;
      const {tunnels} = store.getState();
      const activeTunnel = tunnels.get(tunnel);
      invariant(activeTunnel);
      if (activeTunnel.subscriptions.count() > 1) {
        const friendlyString = `${tunnelDescription(tunnel)} (${
          subscription.description
        })`;
        store.getState().consoleOutput.next({
          text: `Reusing tunnel: ${friendlyString}`,
          level: 'info',
        });
        onOpen(null);
        return null;
      }

      return Actions.requestTunnel(
        subscription.description,
        tunnel,
        onOpen,
        subscription.onTunnelClose,
      );
    })
    .mergeMap(action => {
      if (action == null) {
        return Observable.empty();
      } else {
        return Observable.of(action);
      }
    });
}

export function unsubscribeFromTunnelEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.UNSUBSCRIBE_FROM_TUNNEL)
    .mergeMap(async action => {
      invariant(action.type === Actions.UNSUBSCRIBE_FROM_TUNNEL);
      const {subscription, tunnel} = action.payload;
      const {tunnels} = store.getState();
      const activeTunnel = tunnels.get(tunnel);
      if (
        activeTunnel == null ||
        activeTunnel.error != null ||
        activeTunnel.state === 'initializing'
      ) {
        // We want to show the tunnel error message only once, not for every subscription.
        return null;
      }
      const friendlyString = `${tunnelDescription(tunnel)} (${
        subscription.description
      })`;
      if (activeTunnel.subscriptions.count() > 0) {
        store.getState().consoleOutput.next({
          text: `Stopped reusing tunnel: ${friendlyString}`,
          level: 'info',
        });
        // Don't close the tunnel just yet, there are other subscribers.
        return null;
      } else {
        store.getState().consoleOutput.next({
          text: `Closed tunnel: ${friendlyString}`,
          level: 'info',
        });
      }

      if (activeTunnel.state === 'closing') {
        return null;
      }

      return Actions.closeTunnel(tunnel, null);
    })
    .mergeMap(action => {
      if (action == null) {
        return Observable.empty();
      } else {
        return Observable.of(action);
      }
    });
}

export function requestTunnelEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.REQUEST_TUNNEL)
    .mergeMap(async action => {
      invariant(action.type === Actions.REQUEST_TUNNEL);
      const {tunnel, onOpen} = action.payload;
      const {from, to} = tunnel;

      const useBigDigTunnel = await passesGK('nuclide_big_dig_tunnel');

      const remoteTunnelHost = from.host === 'localhost' ? to : from;
      const localTunnelHost = from.host === 'localhost' ? from : to;
      const isReverse = from.host !== 'localhost';
      const useIPv4 = to.family === 4;

      const fromService = getSocketServiceByHost(from.host);
      const toService = getSocketServiceByHost(to.host);
      const bigDigClient = getBigDigClientByNuclideUri(remoteTunnelHost.host);

      let clientCount = 0;
      const connectionFactory = await toService.getConnectionFactory();

      let subscription;
      let newTunnelPromise;

      let isTunnelOpen = false;
      const open = () => {
        if (!useBigDigTunnel) {
          const events = fromService.createTunnel(tunnel, connectionFactory);
          subscription = events.refCount().subscribe({
            next: event => {
              if (event.type === 'server_started') {
                const state = store.getState();
                const activeTunnel = state.tunnels.get(tunnel);
                invariant(activeTunnel);
                const friendlyString = `${tunnelDescription(
                  tunnel,
                )} (${activeTunnel.subscriptions
                  .map(s => s.description)
                  .join(', ')})`;
                state.consoleOutput.next({
                  text: `Opened tunnel: ${friendlyString}`,
                  level: 'info',
                });
                isTunnelOpen = true;
                store.dispatch(Actions.setTunnelState(tunnel, 'ready'));
                onOpen();
              } else if (event.type === 'client_connected') {
                clientCount++;
                store.dispatch(Actions.setTunnelState(tunnel, 'active'));
              } else if (event.type === 'client_disconnected') {
                clientCount--;
                if (clientCount === 0) {
                  store.dispatch(Actions.setTunnelState(tunnel, 'ready'));
                }
              }
            },
            error: error => {
              if (!isTunnelOpen) {
                onOpen(error);
              }
              store.dispatch(Actions.closeTunnel(tunnel, error));
            },
          });
        } else {
          logger.info(
            `using Big Dig to create a tunnel: ${localTunnelHost.port}<=>${
              remoteTunnelHost.port
            }`,
          );

          newTunnelPromise = bigDigClient
            .createTunnel(localTunnelHost.port, remoteTunnelHost.port, {
              isReverse,
              useIPv4,
            })
            .catch(error => {
              onOpen(error);
              store.dispatch(Actions.closeTunnel(tunnel, error));
              throw error;
            });

          newTunnelPromise.then(newTunnel => {
            newTunnel.on('error', error => {
              logger.error('error from tunnel: ', error);
              store.dispatch(Actions.closeTunnel(tunnel, error));
            });
            newTunnel.on('close', () =>
              store.dispatch(Actions.closeTunnel(tunnel, null)),
            );
            store.dispatch(Actions.setTunnelState(tunnel, 'ready'));
            onOpen();

            const friendlyString = `${tunnelDescription(tunnel)}`;

            const state = store.getState();
            state.consoleOutput.next({
              text: `Opened tunnel: ${friendlyString}`,
              level: 'info',
            });
          });
        }
      };

      let close;

      if (!useBigDigTunnel) {
        close = () => subscription.unsubscribe();
      } else {
        close = () => {
          newTunnelPromise.then(newTunnel => newTunnel.close()).catch(e => {
            logger.error('Tunnel error on close: ', e);
          });
        };
      }

      return Actions.openTunnel(tunnel, open, close);
    })
    .mergeMap(action => {
      if (action == null) {
        return Observable.empty();
      } else {
        return Observable.of(action);
      }
    });
}

export function openTunnelEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.OPEN_TUNNEL)
    .do(action => {
      invariant(action.type === Actions.OPEN_TUNNEL);
      action.payload.open();
    })
    .ignoreElements();
}

export function closeTunnelEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.CLOSE_TUNNEL).map(action => {
    invariant(action.type === Actions.CLOSE_TUNNEL);
    const {tunnels} = store.getState();
    const {error, tunnel} = action.payload;
    const activeTunnel = tunnels.get(tunnel);

    if (activeTunnel != null) {
      if (activeTunnel.close != null) {
        activeTunnel.close(error);
      }
      activeTunnel.subscriptions.forEach(s => s.onTunnelClose(error));
      if (error != null) {
        const friendlyString = `${tunnelDescription(
          tunnel,
        )} (${activeTunnel.subscriptions.map(s => s.description).join(', ')})`;
        store.getState().consoleOutput.next({
          text: `Tunnel error: ${friendlyString}\n${
            error.message != null ? error.message : (error: any).code
          }`,
          level: 'error',
        });
      }
    }

    return Actions.deleteTunnel(tunnel);
  });
}
