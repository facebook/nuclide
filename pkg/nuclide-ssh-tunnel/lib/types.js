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
  openTunnel(tunnel: Tunnel): IDisposable,
};

export type Store = {
  getState(): AppState,
  dispatch(action: Action): void,
};

export type AppState = {
  openTunnels: Immutable.Map<Tunnel, () => void>,
};

export type Remote = {
  host: string,
  port: string,
};

export type Local = {
  host: 'localhost',
  port: string,
};

export type Tunnel = {
  from: Remote,
  to: Local,
};

export type Action = OpenTunnelAction | AddOpenTunnelAction | CloseTunnelAction;

export type OpenTunnelAction = {
  type: 'OPEN_TUNNEL',
  payload: {
    tunnel: Tunnel,
  },
};

export type AddOpenTunnelAction = {
  type: 'ADD_OPEN_TUNNEL',
  payload: {
    tunnel: Tunnel,
    close: () => void,
  },
};

export type CloseTunnelAction = {
  type: 'CLOSE_TUNNEL',
  payload: {
    tunnel: Tunnel,
  },
};
