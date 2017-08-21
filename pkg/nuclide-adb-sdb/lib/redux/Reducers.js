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

import type {Action, AppState} from '../types';

import * as Actions from './Actions';

export function app(state: AppState, action: Action): AppState {
  switch (action.type) {
    case Actions.SET_CUSTOM_ADB_PATH:
      const customAdbPaths = new Map(state.customAdbPaths);
      customAdbPaths.set(action.payload.host, action.payload.path);
      return {
        ...state,
        customAdbPaths,
      };

    case Actions.SET_CUSTOM_SDB_PATH:
      const customSdbPaths = new Map(state.customSdbPaths);
      customSdbPaths.set(action.payload.host, action.payload.path);
      return {
        ...state,
        customSdbPaths,
      };

    case Actions.SET_ADB_PORT:
      const adbPorts = new Map(state.adbPorts);
      adbPorts.set(action.payload.host, action.payload.port);
      return {
        ...state,
        adbPorts,
      };
    default:
      return state;
  }
}
