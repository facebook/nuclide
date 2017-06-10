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
  Tunnel,
} from '../types';

export const OPEN_TUNNEL = 'OPEN_TUNNEL';
export const ADD_OPEN_TUNNEL = 'ADD_OPEN_TUNNEL';
export const CLOSE_TUNNEL = 'CLOSE_TUNNEL';

export function openTunnel(tunnel: Tunnel): OpenTunnelAction {
  return {
    type: OPEN_TUNNEL,
    payload: {tunnel},
  };
}

export function addOpenTunnel(
  tunnel: Tunnel,
  close: () => void,
): AddOpenTunnelAction {
  return {
    type: ADD_OPEN_TUNNEL,
    payload: {tunnel, close},
  };
}

export function closeTunnel(tunnel: Tunnel): CloseTunnelAction {
  return {
    type: CLOSE_TUNNEL,
    payload: {tunnel},
  };
}
