'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {ActionsObservable} from '../../../commons-node/redux-observable';
import type {Store} from '../types';
import type {Action} from './Actions';

import invariant from 'assert';
import {Observable} from 'rxjs';
import {getBuckProjectRoot, getBuckService} from '../../../nuclide-buck-base';
import * as IosSimulator from '../../../nuclide-ios-common';
import * as Actions from './Actions';

export function setProjectRootEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.SET_PROJECT_ROOT)
    .switchMap(action => {
      invariant(action.type === Actions.SET_PROJECT_ROOT);
      const {projectRoot} = action;
      const rootObs = projectRoot == null ? Observable.of(null) :
        Observable.fromPromise(getBuckProjectRoot(projectRoot));
      return rootObs
        .switchMap(buckRoot => Observable.of(
          {type: Actions.SET_BUCK_ROOT, buckRoot},
          // Also refresh the rule type of the current target.
          Actions.setBuildTarget(store.getState().buildTarget),
        ));
    });
}

// Intentionally not exposed in Actions; this shouldn't be used externally.
function setRuleType(ruleType: ?string): Action {
  return {type: Actions.SET_RULE_TYPE, ruleType};
}

export function setBuildTargetEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.SET_BUILD_TARGET)
    .switchMap(action => {
      invariant(action.type === Actions.SET_BUILD_TARGET);
      const {buildTarget} = action;
      const {buckRoot} = store.getState();
      if (buckRoot == null || buildTarget === '') {
        return Observable.of(setRuleType(null));
      }
      const buckService = getBuckService(buckRoot);
      if (buckService == null) {
        return Observable.of(setRuleType(null));
      }
      return Observable.fromPromise(buckService.buildRuleTypeFor(buckRoot, buildTarget))
        .catch(() => Observable.of(null))
        .switchMap(ruleType => Observable.concat(
          Observable.of(setRuleType(ruleType)),
          // Fetch the device list for iOS devices.
          // TODO: extend this to other target types via provider.
          ruleType === 'apple_bundle' ? Observable.of(Actions.fetchDevices())
            : Observable.empty(),
        ));
    });
}

export function fetchDevicesEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.FETCH_DEVICES)
    .switchMap(action => {
      return IosSimulator.getDevices()
        .map(devices => ({type: Actions.SET_DEVICES, devices}));
    });
}
