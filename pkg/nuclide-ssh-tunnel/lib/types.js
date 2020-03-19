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

import type {ResolvedTunnel} from 'nuclide-adb/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Subject} from 'rxjs';
import type {ConsoleMessage} from 'atom-ide-ui';
import type {ActiveTunnels} from './ActiveTunnels';

import {Map, Set} from 'immutable';

export type Store = {
  subscribe(() => void): () => void,
  getState(): AppState,
  dispatch(action: Action): void,
};

export type AppState = {
  openTunnels: Map<ResolvedTunnel, OpenTunnel>,
  tunnels: ActiveTunnels,
  currentWorkingDirectory: ?NuclideUri,
  consoleOutput: Subject<ConsoleMessage>,
};

export type TunnelSubscription = {
  description: string,
  onTunnelClose: (?Error) => void,
};

export type ActiveTunnel = $ReadOnly<{
  tunnel: ResolvedTunnel,
  subscriptions: Set<TunnelSubscription>,
  state: TunnelState,
  error: ?Error,
  close?: (?Error) => void,
}>;

export type OpenTunnel = {
  close(error: ?Error): void,
  state: TunnelState,
};

export type TunnelState = 'initializing' | 'ready' | 'active' | 'closing';

export type Action =
  | CloseTunnelAction
  | DeleteTunnelAction
  | OpenTunnelAction
  | RequestTunnelAction
  | SetCurrentWorkingDirectoryAction
  | SetTunnelStateAction
  | SubscribeToTunnelAction
  | UnsubscribeFromTunnelAction;

export type CloseTunnelAction = {
  type: 'CLOSE_TUNNEL',
  payload: {
    tunnel: ResolvedTunnel,
    error: ?Error,
  },
};

export type DeleteTunnelAction = {
  type: 'DELETE_TUNNEL',
  payload: {
    tunnel: ResolvedTunnel,
  },
};

export type OpenTunnelAction = {
  type: 'OPEN_TUNNEL',
  payload: {
    tunnel: ResolvedTunnel,
    open: () => void,
    close: (?Error) => void,
  },
};

export type RequestTunnelAction = {
  type: 'REQUEST_TUNNEL',
  payload: {
    description: string,
    tunnel: ResolvedTunnel,
    onOpen: (?Error) => void,
    onClose: (?Error) => void,
  },
};

export type SetCurrentWorkingDirectoryAction = {
  type: 'SET_CURRENT_WORKING_DIRECTORY',
  payload: {
    directory: ?string,
  },
};

export type SetTunnelStateAction = {
  type: 'SET_TUNNEL_STATE',
  payload: {
    tunnel: ResolvedTunnel,
    state: TunnelState,
  },
};

export type SubscribeToTunnelAction = {
  type: 'SUBSCRIBE_TO_TUNNEL',
  payload: {
    onOpen: (?Error) => void,
    subscription: TunnelSubscription,
    tunnel: ResolvedTunnel,
  },
};

export type UnsubscribeFromTunnelAction = {
  type: 'UNSUBSCRIBE_FROM_TUNNEL',
  payload: {
    subscription: TunnelSubscription,
    tunnel: ResolvedTunnel,
  },
};
