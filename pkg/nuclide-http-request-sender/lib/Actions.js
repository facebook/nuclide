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

import type {
  UpdateStateAction,
  SendRequestAction,
  PartialAppState,
} from './types';

export const UPDATE_STATE = 'UPDATE_STATE';
export const SEND_REQUEST = 'SEND_REQUEST';

export function updateState(state: PartialAppState): UpdateStateAction {
  return {
    type: UPDATE_STATE,
    payload: {state},
  };
}

export function sendHttpRequest(): SendRequestAction {
  return {
    type: SEND_REQUEST,
  };
}
