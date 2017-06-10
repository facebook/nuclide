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

import type {ActionsObservable} from '../../../commons-node/redux-observable';
import type {Action, Store} from '../types';

import * as Actions from './Actions';
import {Observable} from 'rxjs';
import invariant from 'assert';

export function startTunnelEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.OPEN_TUNNEL).map(action => {
    invariant(action.type === Actions.OPEN_TUNNEL);
    const {tunnel} = action.payload;
    // TODO: Call autossh to open a reverse tunnel
    return Actions.addOpenTunnel(tunnel, () => {});
  });
}
