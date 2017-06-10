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

import type {
  Action,
  AppState,
  Location,
  Opener,
  Store,
  Viewable,
} from '../types';
import type {ActionsObservable} from '../../../commons-node/redux-observable';

import {
  LocalStorageJsonTable,
} from '../../../commons-atom/LocalStorageJsonTable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import analytics from 'nuclide-commons-atom/analytics';
import * as Actions from './Actions';
import getNewLocation from '../getNewLocation';
import invariant from 'assert';
import {Observable} from 'rxjs';

type ItemAndLocation = {
  item: Viewable,
  location: Location,
};

const preferredLocationStorage = new LocalStorageJsonTable(
  'nuclide:nuclide-workspace-views:preferredLocationIds',
);

/**
 * Register a record provider for every executor.
 */
export function registerLocationFactoryEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.REGISTER_LOCATION_FACTORY).map(action => {
    invariant(action.type === Actions.REGISTER_LOCATION_FACTORY);
    const {locationFactory: factory} = action.payload;

    // Create the location using the state we have serialized for it.
    const {serializedLocationStates} = store.getState();
    const serializedLocationState = serializedLocationStates.get(factory.id);
    const location = factory.create(serializedLocationState);
    return Actions.registerLocation(factory.id, location);
  });
}

export function trackItemLocationsEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.REGISTER_LOCATION).mergeMap(action => {
    invariant(action.type === Actions.REGISTER_LOCATION);
    const {id, location} = action.payload;
    const unregistered = actions.filter(
      a => a.type === Actions.UNREGISTER_LOCATION && a.payload.id === id,
    );
    // Since items can be added via means other than the workspace views API (e.g. dragging and
    // dropping), we need to register a listener.
    return observableFromSubscribeFunction(location.onDidAddItem.bind(location))
      .filter(item => item.getURI != null)
      .takeUntil(unregistered)
      .do(item => {
        // Store the preferred location for recall later.
        invariant(item.getURI != null);
        preferredLocationStorage.setItem(item.getURI(), id);
      })
      .ignoreElements();
  });
}

/**
 * Convert actions into tracking events. We perform the side-effect of actually calling track in
 * another epic and keep this one pure.
 */
export function trackActionsEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return (
    actions
      .ofType(Actions.ITEM_CREATED)
      // Map to a tracking event.
      .map(action => {
        invariant(action.type === Actions.ITEM_CREATED);
        const {itemType} = action.payload;
        // TODO: Appeal to `item` for custom tracking event here. Let's wait until we need that
        //   though.
        return Actions.track({
          type: 'workspace-view-created',
          data: {itemType},
        });
      })
  );
}

/**
 * Make tracking requests.
 */
export function trackEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.TRACK)
    .map(action => {
      invariant(action.type === Actions.TRACK);
      return action.payload.event;
    })
    .do(analytics.trackEvent)
    .ignoreElements();
}

export function openEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return bufferUntilDidActivateInitialPackages(actions)
    .filter(action => action.type === Actions.OPEN)
    .switchMap(action => {
      const {locations, openers} = store.getState();
      invariant(action.type === Actions.OPEN);
      const {uri, options} = action.payload;
      const {searchAllPanes, activateItem, activateLocation} = options;

      let itemAndLocation;
      let item;
      let location;
      let itemCreated = false;

      if (searchAllPanes) {
        itemAndLocation = findItem(
          locations.values(),
          it => it.getURI != null && it.getURI() === uri,
        );
      }

      if (itemAndLocation == null) {
        // We need to create the item.
        item = createViewable(uri, openers);
        if (item == null) {
          throw new Error(`No opener found for URI ${uri}`);
        }

        // Find a location for this viewable.
        const preferredLocationId = preferredLocationStorage.getItem(uri);
        if (preferredLocationId != null) {
          location = locations.get(getNewLocation(preferredLocationId));
        }
        if (location == null) {
          const defaultLocationId = item.getDefaultLocation != null
            ? item.getDefaultLocation()
            : null;
          if (defaultLocationId != null) {
            location = locations.get(defaultLocationId);
          }
        }

        // If we don't have a location, just use any one we know about.
        if (location == null) {
          location = getFirstValue(locations);
        }

        // If we still don't have a location, give up.
        if (location == null) {
          return Observable.empty();
        }

        itemCreated = true;
      } else {
        item = itemAndLocation.item;
        location = itemAndLocation.location;
      }

      location.addItem(item);

      if (activateItem) {
        location.activateItem(item);
      }

      if (activateLocation) {
        location.activate();
      }

      return itemCreated
        ? Observable.of(Actions.itemCreated(item, uri))
        : Observable.empty();
    });
}

export function toggleItemVisibilityEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return bufferUntilDidActivateInitialPackages(actions)
    .filter(action => action.type === Actions.TOGGLE_ITEM_VISIBILITY)
    .switchMap(action => {
      invariant(action.type === Actions.TOGGLE_ITEM_VISIBILITY);
      const {uri, visible} = action.payload;
      const state = store.getState();

      // Does an item matching this URI already exist?
      const itemsAndLocations = findAllItems(
        state.locations.values(),
        it => it.getURI != null && it.getURI() === uri,
      );

      if (itemsAndLocations.length === 0) {
        if (visible === false) {
          return Observable.empty();
        }
        // We need to create and add the item.
        return Observable.of(Actions.open(uri, {searchAllPanes: false}));
      }

      // Change the visibility of all matching items. If some are visible and some aren't, this
      // won't be a true toggle, but it makes more sense.
      const makeVisible = visible != null
        ? visible
        : !itemsAndLocations.some(({item, location}) =>
            location.itemIsVisible(item),
          );
      return Observable.from(
        itemsAndLocations.map(({item, location}) =>
          Actions.setItemVisibility({
            item,
            locationId: getLocationId(location, state),
            visible: makeVisible,
          }),
        ),
      );
    });
}

export function setItemVisibilityEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.SET_ITEM_VISIBILITY)
    .do(action => {
      invariant(action.type === Actions.SET_ITEM_VISIBILITY);
      const {item, locationId, visible} = action.payload;
      const location = store.getState().locations.get(locationId);
      invariant(location != null);
      if (visible) {
        location.activateItem(item);
        location.activate();
      } else {
        location.hideItem(item);
      }
    })
    .ignoreElements();
}

export function unregisterLocationEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.UNREGISTER_LOCATION)
    .do(action => {
      invariant(action.type === Actions.UNREGISTER_LOCATION);
      const {id} = action.payload;
      // Destroy the location.
      const location = store.getState().locations.get(id);

      invariant(location != null);
      if (typeof location.destroy === 'function') {
        location.destroy();
      }
    })
    .map(action => {
      invariant(action.type === Actions.UNREGISTER_LOCATION);
      return Actions.locationUnregistered(action.payload.id);
    });
}

export function destroyWhereEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.DESTROY_WHERE)
    .do(action => {
      invariant(action.type === Actions.DESTROY_WHERE);
      const {predicate} = action.payload;

      for (const location of store.getState().locations.values()) {
        for (const item of location.getItems()) {
          if (predicate(item)) {
            location.destroyItem(item);
          }
        }
      }
    })
    .ignoreElements();
}

function findAllItems(
  locations: Iterable<Location>,
  predicate: (item: Viewable) => boolean,
): Array<ItemAndLocation> {
  const itemsAndLocations = [];
  for (const location of locations) {
    for (const item of location.getItems()) {
      if (predicate(item)) {
        itemsAndLocations.push({item, location});
      }
    }
  }
  return itemsAndLocations;
}

function findItem(
  locations: Iterable<Location>,
  predicate: (item: Viewable) => boolean,
): ?ItemAndLocation {
  for (const location of locations) {
    for (const item of location.getItems()) {
      if (predicate(item)) {
        return {item, location};
      }
    }
  }
}

function getLocationId(location: Location, state: AppState): string {
  for (const [id, loc] of state.locations.entries()) {
    if (location === loc) {
      return id;
    }
  }
  // You should never get here.
  throw new Error();
}

function createViewable(uri: string, openers: Set<Opener>): ?Viewable {
  for (const opener of openers) {
    const viewable = opener(uri);
    if (viewable != null) {
      return viewable;
    }
  }
}

/**
 * Some packages (nuclide-home) will call the command that triggers actions during their activation.
 * However, that may be before locations have had a chance to register. Therefore, we want to defer
 * the command.
 */
function bufferUntilDidActivateInitialPackages(
  actions: ActionsObservable<Action>,
): Observable<Action> {
  const didActivateInitialPackages = actions
    .ofType(Actions.DID_ACTIVATE_INITIAL_PACKAGES)
    .take(1);
  const missed = actions.buffer(didActivateInitialPackages).take(1).concatAll();
  return Observable.concat(missed, actions);
}

function getFirstValue<T>(map: Map<any, T>): ?T {
  for (const value of map.values()) {
    return value;
  }
}
