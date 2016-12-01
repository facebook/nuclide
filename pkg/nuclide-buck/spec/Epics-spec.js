'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {Observable} from 'rxjs';
import {ActionsObservable} from '../../commons-node/redux-observable';
import * as BuckBase from '../../nuclide-buck-base';
import * as IosSimulator from '../../nuclide-ios-common';
import * as Actions from '../lib/redux/Actions';
import {
  setProjectRootEpic,
  setBuildTargetEpic,
  fetchDevicesEpic,
} from '../lib/redux/Epics';

const mockStore = {
  dispatch(action) {},
  getState(): any {
    return {
      buckRoot: '/test',
      buildTarget: 'test',
    };
  },
};

describe('setProjectRootEpic', () => {
  it('Sets the Buck root to null for null projects', () => {
    waitsForPromise(async () => {
      const stream = await setProjectRootEpic(
        new ActionsObservable(Observable.of(Actions.setProjectRoot(null))),
        mockStore,
      ).toArray().toPromise();

      expect(stream).toEqual([
        {type: Actions.SET_BUCK_ROOT, buckRoot: null},
        Actions.setBuildTarget('test'),
      ]);
    });
  });

  it('Gets the Buck root for a real project', () => {
    waitsForPromise(async () => {
      spyOn(BuckBase, 'getBuckProjectRoot').andReturn(Promise.resolve('test_buck'));

      const stream = await setProjectRootEpic(
        new ActionsObservable(Observable.of(Actions.setProjectRoot('test'))),
        mockStore,
      ).toArray().toPromise();

      expect(stream).toEqual([
        {type: Actions.SET_BUCK_ROOT, buckRoot: 'test_buck'},
        Actions.setBuildTarget('test'),
      ]);
    });
  });
});

describe('setBuildTargetEpic', () => {
  it('sets a null rule type with an empty build target', () => {
    waitsForPromise(async () => {
      const stream = await setBuildTargetEpic(
        new ActionsObservable(Observable.of(Actions.setBuildTarget(''))),
        mockStore,
      ).toArray().toPromise();

      expect(stream).toEqual([
        {type: Actions.SET_RULE_TYPE, ruleType: null},
      ]);
    });
  });

  it('gets devices with apple_bundle', () => {
    waitsForPromise(async () => {
      spyOn(BuckBase, 'getBuckService').andReturn({
        buildRuleTypeFor() {
          return Promise.resolve('apple_bundle');
        },
      });

      const stream = await setBuildTargetEpic(
        new ActionsObservable(Observable.of(Actions.setBuildTarget('test'))),
        mockStore,
      ).toArray().toPromise();

      expect(stream).toEqual([
        {type: Actions.SET_RULE_TYPE, ruleType: 'apple_bundle'},
        Actions.fetchDevices(),
      ]);
    });
  });
});

describe('fetchDevicesEpic', () => {
  it('gets a list of iOS devices', () => {
    waitsForPromise(async () => {
      spyOn(IosSimulator, 'getDevices').andReturn(Observable.of(['test']));

      const stream = await fetchDevicesEpic(
        new ActionsObservable(Observable.of(Actions.fetchDevices())),
        mockStore,
      ).toArray().toPromise();

      expect(stream).toEqual([
        {type: Actions.SET_DEVICES, devices: ['test']},
      ]);
    });
  });
});
