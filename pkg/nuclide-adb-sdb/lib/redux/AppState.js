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

import type {AppState} from '../types';

import {objectEntries, objectFromMap} from 'nuclide-commons/collection';

export function createEmptyAppState(): AppState {
  return {
    customAdbPaths: new Map(),
    customSdbPaths: new Map(),
  };
}

export function serialize(state: AppState): Object {
  return {
    customAdbPaths: objectFromMap(state.customAdbPaths),
    customSdbPaths: objectFromMap(state.customSdbPaths),
  };
}

export function deserialize(rawState: ?Object): ?Object {
  if (rawState != null) {
    ['customAdbPaths', 'customSdbPaths'].forEach(objectProp => {
      if (rawState.hasOwnProperty(objectProp)) {
        rawState[objectProp] = new Map(
          objectEntries(rawState[objectProp] || {}),
        );
      }
    });
  }
  return rawState;
}
