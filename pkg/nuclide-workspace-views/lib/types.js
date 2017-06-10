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

import type {TrackingEvent} from '../../nuclide-analytics';

import type {
  Viewable,
  Opener,
  OpenOptions,
  Location,
  LocationFactory,
  ToggleOptions,
  WorkspaceViewsService,
} from 'nuclide-commons-atom/workspace-views-compat';

export type {
  Viewable,
  Opener,
  OpenOptions,
  Location,
  LocationFactory,
  ToggleOptions,
  WorkspaceViewsService,
};

export type AppState = {
  locations: Map<string, Location>,
  openers: Set<Opener>,
  serializedLocationStates: Map<string, ?Object>,
};

export type SerializedAppState = {
  serializedLocationStates: {[locationId: string]: ?Object},
};

export type Store = {
  getState(): AppState,
  dispatch(action: Action): void,
};

//
// Actions
//

type AddOpenerAction = {
  type: 'ADD_OPENER',
  payload: {
    opener: Opener,
  },
};

type DestroyWhereAction = {
  type: 'DESTROY_WHERE',
  payload: {
    predicate: (item: Viewable) => boolean,
  },
};

type DidActivateInitialPackagesAction = {
  type: 'DID_ACTIVATE_INITIAL_PACKAGES',
};

type RemoveOpenerAction = {
  type: 'REMOVE_OPENER',
  payload: {
    opener: Opener,
  },
};

type OpenAction = {
  type: 'OPEN',
  payload: {
    uri: string,
    options: {
      searchAllPanes: boolean,
      activateItem: boolean,
      activateLocation: boolean,
    },
  },
};

type ItemCreatedAction = {
  type: 'ITEM_CREATED',
  payload: {
    item: Object,
    itemType: string,
  },
};

type RegisterLocationAction = {
  type: 'REGISTER_LOCATION',
  payload: {
    id: string,
    location: Location,
  },
};

type RegisterLocationFactoryAction = {
  type: 'REGISTER_LOCATION_FACTORY',
  payload: {
    locationFactory: LocationFactory,
  },
};

type UnregisterLocationAction = {
  type: 'UNREGISTER_LOCATION',
  payload: {
    id: string,
  },
};

type LocationUnregisteredAction = {
  type: 'LOCATION_UNREGISTERED',
  payload: {
    id: string,
  },
};

type SetItemVisibilityAction = {
  type: 'SET_ITEM_VISIBILITY',
  payload: {
    item: Viewable,
    locationId: string,
    visible: boolean,
  },
};

type ToggleItemVisibilityAction = {
  type: 'TOGGLE_ITEM_VISIBILITY',
  payload: {
    uri: string,
    visible: ?boolean,
  },
};

type TrackAction = {
  type: 'TRACK',
  payload: {
    event: TrackingEvent,
  },
};

export type Action =
  | AddOpenerAction
  | DestroyWhereAction
  | DidActivateInitialPackagesAction
  | RemoveOpenerAction
  | OpenAction
  | ItemCreatedAction
  | TrackAction
  | RegisterLocationAction
  | RegisterLocationFactoryAction
  | UnregisterLocationAction
  | LocationUnregisteredAction
  | SetItemVisibilityAction
  | ToggleItemVisibilityAction;
