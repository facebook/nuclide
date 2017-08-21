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
import type {Action, Store, Parameter} from './types';

import * as Actions from './Actions';
import {Observable} from 'rxjs';
import querystring from 'querystring';
import invariant from 'assert';
import xfetch from '../../commons-node/xfetch';
import {track} from '../../nuclide-analytics';

function _formatUri(
  method: string,
  uri: string,
  parameters: Array<Parameter>,
): string {
  // Generate object of valid and non-duplicate parameter key/value pairs
  const queryParameters = parameters.reduce((paramObj, param) => {
    if (param && param.key) {
      const trimmedKey = param.key.trim();
      if (!paramObj.hasOwnProperty(trimmedKey)) {
        paramObj[trimmedKey] = param.value.trim();
      }
    }
    return paramObj;
  }, {});
  const queryString = querystring.stringify(queryParameters);
  return `${uri}${queryString ? '?' : ''}${queryString}`;
}

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
        const {uri, method, headers, body, parameters} = store.getState();
        const formattedUri = encodeURI(_formatUri(method, uri, parameters));
        const options =
          method === 'POST'
            ? {method, credentials, headers, body}
            : {method, credentials, headers};
        track('nuclide-http-request-sender:http-request', {
          formattedUri,
          options,
        });
        xfetch(formattedUri, options);
      })
      // This epic is just for side-effects.
      .ignoreElements()
  );
}
