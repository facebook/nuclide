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

import type {
  OpenTunnelAction,
  AddOpenTunnelAction,
  CloseTunnelAction,
  SetTunnelStateAction,
  Tunnel,
  TunnelState,
} from '../types';

export const OPEN_TUNNEL = 'OPEN_TUNNEL';
export const ADD_OPEN_TUNNEL = 'ADD_OPEN_TUNNEL';
export const CLOSE_TUNNEL = 'CLOSE_TUNNEL';
export const SET_TUNNEL_STATE = 'SET_TUNNEL_STATE';

export function openTunnel(
  tunnel: Tunnel,
  onOpen: () => void,
  onClose: (?Error) => void,
): OpenTunnelAction {
  return {
    type: OPEN_TUNNEL,
    payload: {tunnel, onOpen, onClose},
  };
}

export function addOpenTunnel(
  tunnel: Tunnel,
  close: (?Error) => void,
): AddOpenTunnelAction {
  return {
    type: ADD_OPEN_TUNNEL,
    payload: {tunnel, close},
  };
}

export function closeTunnel(tunnel: Tunnel, error: ?Error): CloseTunnelAction {
  return {
    type: CLOSE_TUNNEL,
    payload: {tunnel, error},
  };
}

export function setTunnelState(
  tunnel: Tunnel,
  state: TunnelState,
): SetTunnelStateAction {
  return {
    type: SET_TUNNEL_STATE,
    payload: {tunnel, state},
  };
}
