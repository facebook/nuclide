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

import type {Action, Tunnel} from '../types';

import * as Actions from './Actions';
import Immutable from 'immutable';

export function openTunnels(
  state: Immutable.Map<Tunnel, () => void> = new Immutable.Map(),
  action: Action,
) {
  switch (action.type) {
    case Actions.ADD_OPEN_TUNNEL:
      const {tunnel, close} = action.payload;
      return state.set(tunnel, close);
    case Actions.CLOSE_TUNNEL:
      const toClose = action.payload.tunnel;
      const closeTunnel = state.get(toClose);
      closeTunnel();
      return state.delete(toClose);
    default:
      return state;
  }
}
