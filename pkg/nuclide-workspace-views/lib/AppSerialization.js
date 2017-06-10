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

import type {AppState, SerializedAppState} from './types';

import {objectEntries, objectFromMap} from 'nuclide-commons/collection';
import getNewLocation from './getNewLocation';

export function serialize(state: AppState): SerializedAppState {
  return {
    serializedLocationStates: objectFromMap(
      new Map(
        Array.from(state.locations.entries())
          .map(([id, location]) => {
            const serialized = typeof location.serialize === 'function'
              ? location.serialize()
              : null;
            return [id, serialized];
          })
          .filter(([, serialized]) => serialized != null),
      ),
    ),
  };
}

export function deserialize(rawState: SerializedAppState): AppState {
  return {
    // Viewables and locations will re-register using the service.
    locations: new Map(),
    serializedLocationStates: new Map(
      // Translate the old location ids ("left-panel", "pane", etc.) into the new, Atom-compatible
      // ones ("left", "center", etc.)
      objectEntries(
        rawState.serializedLocationStates || {},
      ).map(([key, value]) => [getNewLocation(key), value]),
    ),
    openers: new Set(),
  };
}
