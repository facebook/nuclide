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

import type {Action, AppState} from './types';

import * as Actions from './Actions';

export function app(state: AppState, action: Action): AppState {
  switch (action.type) {
    case Actions.UPDATE_STATE: {
      const {state: newState} = action.payload;
      return {
        ...state,
        ...newState,
      };
    }
  }
  return state;
}
