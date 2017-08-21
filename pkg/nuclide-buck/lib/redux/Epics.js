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

import type {ActionsObservable} from 'nuclide-commons/redux-observable';
import type {PlatformGroup, Store} from '../types';
import type {Action} from './Actions';
import type {ResolvedRuleType} from '../../../nuclide-buck-rpc/lib/types';

import invariant from 'assert';
import {Observable} from 'rxjs';
import {getBuckProjectRoot, getBuckService} from '../../../nuclide-buck-base';
import * as Actions from './Actions';

export function setProjectRootEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.SET_PROJECT_ROOT).switchMap(action => {
    invariant(action.type === Actions.SET_PROJECT_ROOT);
    const {projectRoot} = action;
    const rootObs =
      projectRoot == null
        ? Observable.of(null)
        : Observable.fromPromise(getBuckProjectRoot(projectRoot));
    return rootObs.switchMap(buckRoot =>
      Observable.of(
        Actions.setBuckRoot(buckRoot),
        // Also refresh the rule type of the current target.
        Actions.setBuildTarget(store.getState().buildTarget),
      ),
    );
  });
}

// Intentionally not exposed in Actions; this shouldn't be used externally.
function setRuleType(ruleType: ?ResolvedRuleType): Action {
  return {type: Actions.SET_RULE_TYPE, ruleType};
}

function setPlatformGroups(platformGroups: Array<PlatformGroup>): Action {
  return {type: Actions.SET_PLATFORM_GROUPS, platformGroups};
}

export function setBuildTargetEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.SET_BUILD_TARGET)
    .switchMap(action => {
      invariant(action.type === Actions.SET_BUILD_TARGET);
      const {buildTarget} = action;
      const {buckRoot} = store.getState();
      if (buckRoot == null || buildTarget === '') {
        return Observable.of(null);
      }
      const buckService = getBuckService(buckRoot);
      if (buckService == null) {
        return Observable.of(null);
      }
      return Observable.defer(() =>
        buckService.buildRuleTypeFor(buckRoot, buildTarget),
      ).catch(() => Observable.of(null));
    })
    .switchMap(ruleType => Observable.of(setRuleType(ruleType)));
}

export function setRuleTypeEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.SET_RULE_TYPE).switchMap(action => {
    invariant(action.type === Actions.SET_RULE_TYPE);
    const {ruleType} = action;
    if (ruleType) {
      const state = store.getState();
      // flowlint-next-line sketchy-null-string:off
      invariant(state.buckRoot);
      return state.platformService
        .getPlatformGroups(state.buckRoot, ruleType.type, state.buildTarget)
        .map(platformGroups => setPlatformGroups(platformGroups));
    } else {
      return Observable.of(setPlatformGroups([]));
    }
  });
}
