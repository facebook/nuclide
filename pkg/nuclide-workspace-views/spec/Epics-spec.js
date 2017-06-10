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
  Location,
  LocationFactory,
  Store,
  Viewable,
} from '../lib/types';

import * as Actions from '../lib/redux/Actions';
import {
  openEpic,
  registerLocationFactoryEpic,
  setItemVisibilityEpic,
  trackActionsEpic,
  unregisterLocationEpic,
} from '../lib/redux/Epics';
import {ActionsObservable} from '../../commons-node/redux-observable';
import invariant from 'assert';
import {Observable, ReplaySubject, Subject} from 'rxjs';

describe('Epics', () => {
  describe('registerLocationFactoryEpic', () => {
    it('creates the location using the serialized state from last time', () => {
      waitsForPromise(async () => {
        const serialized = {value: 1};
        const store = {
          getState: () => ({
            serializedLocationStates: new Map([['test-location', serialized]]),
          }),
        };

        const locationFactory = createMockLocationFactory();
        spyOn(locationFactory, 'create');

        await runActions(
          [Actions.registerLocationFactory(locationFactory)],
          registerLocationFactoryEpic,
          ((store: any): Store),
        )
          .first()
          .toPromise();

        expect(locationFactory.create).toHaveBeenCalledWith(serialized);
      });
    });
  });

  describe('openEpic', () => {
    it('creates and shows items', () => {
      const VIEW_URI = 'atom://nuclide/test';
      const item = createMockViewable();
      const opener = jasmine.createSpy('opener').andReturn(item);
      const location = createMockLocation();
      const store = {
        getState: () => ({
          locations: new Map([['test-location', location]]),
          openers: new Set([opener]),
        }),
      };

      spyOn(location, 'activateItem');

      runActions(
        [
          Actions.didActivateInitialPackages(),
          Actions.open(VIEW_URI, {searchAllPanes: false}),
        ],
        openEpic,
        ((store: any): Store),
      );

      expect(opener).toHaveBeenCalled();
      expect(location.activateItem).toHaveBeenCalledWith(item);
    });
  });

  describe('setItemVisibilityEpic', () => {
    it('shows items', () => {
      const location = createMockLocation();
      const store = {
        getState: () => ({
          locations: new Map([['test-location', location]]),
        }),
      };
      const item = createMockViewable();

      spyOn(location, 'activateItem');

      runActions(
        [
          Actions.setItemVisibility({
            item,
            locationId: 'test-location',
            visible: true,
          }),
        ],
        setItemVisibilityEpic,
        ((store: any): Store),
      );
      expect(location.activateItem).toHaveBeenCalledWith(item);
    });

    it('hides items', () => {
      const location = createMockLocation();
      const store = {
        getState: () => ({
          locations: new Map([['test-location', location]]),
        }),
      };
      const item = createMockViewable();

      spyOn(location, 'hideItem');

      runActions(
        [
          Actions.setItemVisibility({
            item,
            locationId: 'test-location',
            visible: false,
          }),
        ],
        setItemVisibilityEpic,
        ((store: any): Store),
      );
      expect(location.hideItem).toHaveBeenCalledWith(item);
    });
  });

  describe('unregisterLocationEpic', () => {
    it('destroys the location', () => {
      const location = createMockLocation();
      const store = {
        getState: () => ({
          locations: new Map([['test-location', location]]),
        }),
      };

      spyOn(location, 'destroy');

      runActions(
        [Actions.unregisterLocation('test-location')],
        unregisterLocationEpic,
        ((store: any): Store),
      );
      expect(location.destroy).toHaveBeenCalledWith();
    });
  });

  describe('trackActionsEpic', () => {
    it('tracks when views are created', () => {
      waitsForPromise(async () => {
        const trackAction = await runActions(
          [Actions.itemCreated({}, 'test-view')],
          trackActionsEpic,
          ((null: any): Store),
        )
          .first()
          .toPromise();
        invariant(trackAction.type === 'TRACK');
        expect(trackAction.type).toBe('TRACK');
        const {event} = trackAction.payload;
        expect(event.type).toBe('workspace-view-created');
        invariant(event.data != null);
        expect(event.data.itemType).toBe('test-view');
      });
    });
  });
});

function createMockLocationFactory(): LocationFactory {
  return {
    id: 'test-location',
    create: createMockLocation,
  };
}

function createMockLocation(): Location {
  const location = {
    activateItem: item => {},
    addItem: item => {},
    destroy: () => {},
    destroyItem: item => {},
    getItems: () => {},
    hideItem: item => {},
  };
  return ((location: any): Location);
}

function createMockViewable(): Viewable {
  const mock = {
    getDefaultLocation: () => 'test-location',
  };
  return ((mock: any): Viewable);
}

type Epic = (
  actions: ActionsObservable<Action>,
  store: Store,
) => Observable<Action>;
function runActions(
  actions: Array<Action>,
  epic: Epic,
  store: Store,
): ReplaySubject<Action> {
  const input = new Subject();
  const output = new ReplaySubject();
  epic(new ActionsObservable(input), store).subscribe(output);
  actions.forEach(input.next.bind(input));
  input.complete();
  return output;
}
