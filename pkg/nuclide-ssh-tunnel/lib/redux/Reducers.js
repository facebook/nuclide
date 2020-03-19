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

import type {ConsoleMessage} from 'atom-ide-ui';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {Action} from '../types';

import {ActiveTunnels} from '../ActiveTunnels';
import * as Actions from './Actions';
import {Set} from 'immutable';
import {Subject} from 'rxjs';

export function tunnels(
  state: ActiveTunnels = new ActiveTunnels(),
  action: Action,
) {
  switch (action.type) {
    case Actions.SUBSCRIBE_TO_TUNNEL:
      let existing = state.get(action.payload.tunnel);
      if (existing == null) {
        existing = {
          tunnel: action.payload.tunnel,
          subscriptions: Set(),
          state: 'initializing',
        };
      }

      return state.set(action.payload.tunnel, {
        ...existing,
        subscriptions: existing.subscriptions.add(action.payload.subscription),
      });

    case Actions.UNSUBSCRIBE_FROM_TUNNEL:
      return state.update(action.payload.tunnel, value => ({
        ...value,
        subscriptions: value.subscriptions.remove(action.payload.subscription),
      }));

    case Actions.OPEN_TUNNEL:
      const toOpen = state.get(action.payload.tunnel);
      return state.set(action.payload.tunnel, {
        ...toOpen,
        close: action.payload.close,
      });

    case Actions.SET_TUNNEL_STATE:
      return state.update(action.payload.tunnel, value => ({
        ...value,
        state: action.payload.state,
      }));

    case Actions.CLOSE_TUNNEL:
      if (state.get(action.payload.tunnel) === undefined) {
        return state;
      }
      return state.update(action.payload.tunnel, value => ({
        ...value,
        error: action.payload.error,
        state: 'closing',
      }));

    case Actions.DELETE_TUNNEL:
      return state.delete(action.payload.tunnel);

    default:
      return state;
  }
}

export function currentWorkingDirectory(
  state: ?NuclideUri = null,
  action: Action,
) {
  switch (action.type) {
    case Actions.SET_CURRENT_WORKING_DIRECTORY:
      return action.payload.directory;
    default:
      return state;
  }
}

export function consoleOutput(
  state: Subject<ConsoleMessage> = new Subject(),
  action: Action,
) {
  return state;
}
