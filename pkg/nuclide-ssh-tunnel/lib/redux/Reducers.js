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

import type {Action, Tunnel, OpenTunnel} from '../types';

import * as Actions from './Actions';
import Immutable from 'immutable';
import invariant from 'assert';

export function openTunnels(
  state: Immutable.Map<Tunnel, OpenTunnel> = new Immutable.Map(),
  action: Action,
) {
  switch (action.type) {
    case Actions.ADD_OPEN_TUNNEL:
      const {close, tunnel} = action.payload;
      return state.set(tunnel, {
        close,
        state: 'initializing',
      });
    case Actions.CLOSE_TUNNEL:
      const toClose = action.payload.tunnel;
      const openTunnel = state.get(toClose);
      openTunnel.close(action.payload.error);
      return state.delete(toClose);
    case Actions.SET_TUNNEL_STATE:
      invariant(state.get(action.payload.tunnel) != null);
      return state.update(action.payload.tunnel, value => ({
        ...value,
        state: action.payload.state,
      }));
    default:
      return state;
  }
}
