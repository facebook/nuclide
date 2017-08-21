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
import type {Action, Store} from '../types';

import {Observable} from 'rxjs';
import * as Actions from './Actions';
import invariant from 'invariant';
import {getAdbServiceByNuclideUri} from '../../../nuclide-remote-connection';
import {getSdbServiceByNuclideUri} from '../../../nuclide-remote-connection';

export function setCustomAdbPathEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.SET_CUSTOM_ADB_PATH)
    .map(action => {
      invariant(action.type === Actions.SET_CUSTOM_ADB_PATH);
      getAdbServiceByNuclideUri(action.payload.host).registerCustomPath(
        action.payload.path,
      );
    })
    .ignoreElements();
}

export function setCustomSdbPathEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.SET_CUSTOM_SDB_PATH)
    .map(action => {
      invariant(action.type === Actions.SET_CUSTOM_SDB_PATH);
      getSdbServiceByNuclideUri(action.payload.host).registerCustomPath(
        action.payload.path,
      );
    })
    .ignoreElements();
}

export function setAdbPortEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.SET_ADB_PORT)
    .map(action => {
      invariant(action.type === Actions.SET_ADB_PORT);
      getAdbServiceByNuclideUri(action.payload.host).addAdbPort(
        action.payload.port,
      );
    })
    .ignoreElements();
}
