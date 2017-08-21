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

import Immutable from 'immutable';

export type SshTunnelService = {
  openTunnel(
    tunnel: Tunnel,
    onOpen: () => void,
    onClose: (?Error) => void,
  ): IDisposable,
};

export type Store = {
  getState(): AppState,
  dispatch(action: Action): void,
};

export type AppState = {
  openTunnels: Immutable.Map<Tunnel, OpenTunnel>,
};

export type Remote = {
  host: string,
  port: number,
};

export type Local = {
  host: 'localhost',
  port: number,
};

export type Tunnel = {
  from: Remote,
  to: Local,
};

export type OpenTunnel = {
  close(error: ?Error): void,
  state: TunnelState,
};

export type TunnelState = 'initializing' | 'ready' | 'active';

export type Action =
  | OpenTunnelAction
  | AddOpenTunnelAction
  | CloseTunnelAction
  | SetTunnelStateAction;

export type OpenTunnelAction = {
  type: 'OPEN_TUNNEL',
  payload: {
    tunnel: Tunnel,
    onOpen: () => void,
    onClose: (?Error) => void,
  },
};

export type AddOpenTunnelAction = {
  type: 'ADD_OPEN_TUNNEL',
  payload: {
    tunnel: Tunnel,
    close: (?Error) => void,
  },
};

export type CloseTunnelAction = {
  type: 'CLOSE_TUNNEL',
  payload: {
    tunnel: Tunnel,
    error: ?Error,
  },
};

export type SetTunnelStateAction = {
  type: 'SET_TUNNEL_STATE',
  payload: {
    tunnel: Tunnel,
    state: TunnelState,
  },
};
