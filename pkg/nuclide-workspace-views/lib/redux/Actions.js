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

import type {TrackingEvent} from '../../../nuclide-analytics';
import type {
  Action,
  Location,
  LocationFactory,
  Opener,
  OpenOptions,
  Viewable,
} from '../types';

export const ADD_OPENER = 'ADD_OPENER';
export const DESTROY_WHERE = 'DESTROY_WHERE';
export const DID_ACTIVATE_INITIAL_PACKAGES = 'DID_ACTIVATE_INITIAL_PACKAGES';
export const REMOVE_OPENER = 'REMOVE_OPENER';
export const OPEN = 'OPEN';
export const ITEM_CREATED = 'ITEM_CREATED';
export const SET_ITEM_VISIBILITY = 'SET_ITEM_VISIBILITY';
export const TOGGLE_ITEM_VISIBILITY = 'TOGGLE_ITEM_VISIBILITY';
export const TRACK = 'TRACK';
export const REGISTER_LOCATION = 'REGISTER_LOCATION';
export const REGISTER_LOCATION_FACTORY = 'REGISTER_LOCATION_FACTORY';
export const UNREGISTER_LOCATION = 'UNREGISTER_LOCATION';
export const LOCATION_UNREGISTERED = 'LOCATION_UNREGISTERED';

export function addOpener(opener: Opener): Action {
  return {
    type: ADD_OPENER,
    payload: {opener},
  };
}

export function destroyWhere(predicate: (item: Viewable) => boolean): Action {
  return {
    type: DESTROY_WHERE,
    payload: {predicate},
  };
}

export function didActivateInitialPackages(): Action {
  return {type: DID_ACTIVATE_INITIAL_PACKAGES};
}

export function removeOpener(opener: Opener): Action {
  return {
    type: REMOVE_OPENER,
    payload: {opener},
  };
}

export function open(uri: string, options?: OpenOptions): Action {
  return {
    type: OPEN,
    payload: {
      uri,
      options: {
        searchAllPanes: Boolean(options && options.searchAllPanes === true),
        activateItem: options == null || options.activateItem !== false,
        activateLocation: options == null || options.activateLocation !== false,
      },
    },
  };
}

export function itemCreated(item: Object, itemType: string) {
  return {
    type: ITEM_CREATED,
    payload: {item, itemType},
  };
}

export function track(event: TrackingEvent) {
  return {
    type: TRACK,
    payload: {event},
  };
}

export function registerLocation(id: string, location: Location): Action {
  return {
    type: REGISTER_LOCATION,
    payload: {id, location},
  };
}

export function registerLocationFactory(
  locationFactory: LocationFactory,
): Action {
  return {
    type: REGISTER_LOCATION_FACTORY,
    payload: {locationFactory},
  };
}

export function unregisterLocation(id: string): Action {
  return {
    type: UNREGISTER_LOCATION,
    payload: {id},
  };
}

export function locationUnregistered(id: string): Action {
  return {
    type: LOCATION_UNREGISTERED,
    payload: {id},
  };
}

type SetItemVisibilityOptions = {
  item: Viewable,
  locationId: string,
  visible: boolean,
};
export function setItemVisibility(options: SetItemVisibilityOptions): Action {
  return {
    type: SET_ITEM_VISIBILITY,
    payload: options,
  };
}

export function toggleItemVisibility(uri: string, visible?: ?boolean): Action {
  return {
    type: TOGGLE_ITEM_VISIBILITY,
    payload: {uri, visible},
  };
}
