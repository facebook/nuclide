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

import type {ActionsObservable} from '../../commons-node/redux-observable';
import type {Action, Store} from './types';

import * as Actions from './Actions';
import {Observable} from 'rxjs';
import invariant from 'assert';
import xfetch from '../../commons-node/xfetch';
import {track} from '../../nuclide-analytics';

export function sendHttpRequest(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return (
    actions
      .ofType(Actions.SEND_REQUEST)
      .do(action => {
        invariant(action.type === Actions.SEND_REQUEST);
        const credentials = 'include'; // We always want to send cookies.
        const {uri, method, headers, body} = store.getState();
        const options = method === 'POST'
          ? {method, credentials, headers, body}
          : {method, credentials, headers};
        track('nuclide-http-request-sender:http-request', {uri, options});
        xfetch(uri, options);
      })
      // This epic is just for side-effects.
      .ignoreElements()
  );
}
