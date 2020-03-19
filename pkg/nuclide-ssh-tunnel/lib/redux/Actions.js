/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {ResolvedTunnel} from 'nuclide-adb/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  CloseTunnelAction,
  DeleteTunnelAction,
  OpenTunnelAction,
  RequestTunnelAction,
  SetTunnelStateAction,
  SubscribeToTunnelAction,
  TunnelState,
  TunnelSubscription,
  UnsubscribeFromTunnelAction,
} from '../types';

export const CLOSE_TUNNEL = 'CLOSE_TUNNEL';
export const DELETE_TUNNEL = 'DELETE_TUNNEL';
export const OPEN_TUNNEL = 'OPEN_TUNNEL';
export const REQUEST_TUNNEL = 'REQUEST_TUNNEL';
export const SET_TUNNEL_STATE = 'SET_TUNNEL_STATE';
export const SET_CURRENT_WORKING_DIRECTORY = 'SET_CURRENT_WORKING_DIRECTORY';
export const SUBSCRIBE_TO_TUNNEL = 'SUBSCRIBE_TO_TUNNEL';
export const UNSUBSCRIBE_FROM_TUNNEL = 'UNSUBSCRIBE_FROM_TUNNEL';

export function closeTunnel(
  tunnel: ResolvedTunnel,
  error: ?Error,
): CloseTunnelAction {
  return {
    type: CLOSE_TUNNEL,
    payload: {tunnel, error},
  };
}

export function deleteTunnel(tunnel: ResolvedTunnel): DeleteTunnelAction {
  return {
    type: DELETE_TUNNEL,
    payload: {tunnel},
  };
}

export function openTunnel(
  tunnel: ResolvedTunnel,
  open: () => void,
  close: () => void,
): OpenTunnelAction {
  return {
    type: OPEN_TUNNEL,
    payload: {tunnel, open, close},
  };
}

export function requestTunnel(
  description: string,
  tunnel: ResolvedTunnel,
  onOpen: (?Error) => void,
  onClose: (?Error) => void,
): RequestTunnelAction {
  return {
    type: REQUEST_TUNNEL,
    payload: {description, tunnel, onOpen, onClose},
  };
}

export function setTunnelState(
  tunnel: ResolvedTunnel,
  state: TunnelState,
): SetTunnelStateAction {
  return {
    type: SET_TUNNEL_STATE,
    payload: {tunnel, state},
  };
}

export function setCurrentWorkingDirectory(directory: ?NuclideUri) {
  return {
    type: SET_CURRENT_WORKING_DIRECTORY,
    payload: {directory},
  };
}

export function subscribeToTunnel(
  subscription: TunnelSubscription,
  tunnel: ResolvedTunnel,
  onOpen: (?Error) => void,
): SubscribeToTunnelAction {
  return {
    type: SUBSCRIBE_TO_TUNNEL,
    payload: {onOpen, subscription, tunnel},
  };
}

export function unsubscribeFromTunnel(
  subscription: TunnelSubscription,
  tunnel: ResolvedTunnel,
): UnsubscribeFromTunnelAction {
  return {
    type: UNSUBSCRIBE_FROM_TUNNEL,
    payload: {subscription, tunnel},
  };
}
