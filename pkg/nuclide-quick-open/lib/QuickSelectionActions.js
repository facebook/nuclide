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

import type QuickSelectionDispatcher from './QuickSelectionDispatcher';

import {ActionTypes} from './QuickSelectionDispatcher';

export default class QuickSelectionActions {
  _dispatcher: QuickSelectionDispatcher;

  constructor(dispatcher: QuickSelectionDispatcher) {
    this._dispatcher = dispatcher;
  }

  query(query: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.QUERY,
      query,
    });
  }

  changeActiveProvider(providerName: string): void {
    this._dispatcher.dispatch({
      actionType: ActionTypes.ACTIVE_PROVIDER_CHANGED,
      providerName,
    });
  }
}
