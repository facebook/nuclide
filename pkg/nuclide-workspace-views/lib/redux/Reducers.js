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

import type {Action, Location, Opener} from '../types';

import * as Actions from './Actions';

export function locations(
  state: Map<string, Location> = new Map(),
  action: Action,
) {
  switch (action.type) {
    case Actions.REGISTER_LOCATION: {
      const {id, location} = action.payload;
      return new Map(state).set(id, location);
    }
    case Actions.LOCATION_UNREGISTERED: {
      const newState = new Map(state);
      newState.delete(action.payload.id);
      return newState;
    }
    default:
      return state;
  }
}

export function openers(state: Set<Opener> = new Set(), action: Action) {
  switch (action.type) {
    case Actions.ADD_OPENER: {
      const {opener} = action.payload;
      return new Set(state).add(opener);
    }
    case Actions.REMOVE_OPENER: {
      const {opener} = action.payload;
      const newState = new Set(state);
      newState.delete(opener);
      return newState;
    }
    default:
      return state;
  }
}

export function serializedLocationStates(
  state: Map<string, ?Object> = new Map(),
  action: Action,
) {
  switch (action.type) {
    case Actions.REGISTER_LOCATION: {
      // Now that we've used the serialized state (to create the location instance), we can get rid
      // of it.
      const newStates = new Map(state);
      newStates.delete(action.payload.id);
      return newStates;
    }
    default:
      return state;
  }
}
