/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
/* global localStorage */

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import {NuxManager} from '../lib/NuxManager';
import {NuxStore, NUX_SAVED_STORE} from '../lib/NuxStore';

import type {NuxTourModel} from '../lib/NuxModel';

const NUX_TOUR_SPEC_EXAMPLE_NUX_ID = -1;
const NUX_TOUR_SPEC_EXAMPLE_NUX_NAME = 'nuclide-nux-spec.nux-tour-sample';

describe('NuxTour', () => {
  function generateTestNuxTour(
    id: number,
    name: string,
    numViews: number = 1,
  ): NuxTourModel {
    const nuxViewModel = {
      content: 'Content',
      selector: '.something',
      position: 'auto',
      completionPredicate: null,
    };
    return {
      id,
      name,
      nuxList: Array(numViews).fill(nuxViewModel),
    };
  }

  let nuxStore;
  let disposables: UniversalDisposable;
  let nuclideNuxState;

  beforeEach(() => {
    disposables = new UniversalDisposable();
    // Save viewed state of NUXes
    nuclideNuxState = localStorage.getItem(NUX_SAVED_STORE);
    localStorage.clear();

    nuxStore = new NuxStore();
    disposables.add(nuxStore);
  });

  afterEach(() => {
    disposables.dispose();
    // Restore viewed state of NUXes
    localStorage.setItem(NUX_SAVED_STORE, String(nuclideNuxState));
  });

  it("stores a NuxTour's state in the NuxStore", () => {
    nuxStore.addNewNux(generateTestNuxTour(-1, 'a'));
    nuxStore.addNewNux(generateTestNuxTour(-2, 'b'));

    expect(nuxStore._nuxMap.size).toBe(2);
  });

  it('creates a NuxTour from a NuxTourModel', () => {
    const nuxManager = new NuxManager(nuxStore, () => {});
    disposables.add(nuxManager);

    nuxStore.addNewNux(
      generateTestNuxTour(
        NUX_TOUR_SPEC_EXAMPLE_NUX_ID,
        NUX_TOUR_SPEC_EXAMPLE_NUX_NAME,
      ),
    );

    expect(nuxStore._nuxMap.size).toBe(1);
  });

  it('creates a NuxTour that waits for a trigger', () => {
    const nuxManager = new NuxManager(nuxStore, () => {});
    disposables.add(nuxManager);

    const nuxTour = generateTestNuxTour(
      NUX_TOUR_SPEC_EXAMPLE_NUX_ID,
      NUX_TOUR_SPEC_EXAMPLE_NUX_NAME,
    );
    nuxTour.trigger = {
      triggerType: 'editor',
      triggerCallback: () => false,
    };
    nuxStore.addNewNux(nuxTour);

    expect(nuxStore._nuxMap.size).toBe(1);
    expect(nuxManager._readyToDisplayNuxes.length).toBe(0);
    expect(nuxManager._pendingNuxes.size).toBe(1);
    expect(nuxManager._activeNuxTour != null).toBeFalsy();
  });
});
