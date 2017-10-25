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

import Dispatcher from '../../commons-node/Dispatcher';

export type QuickSelectionAction =
  | {
      actionType: 'ACTIVE_PROVIDER_CHANGED',
      providerName: string,
    }
  | {
      actionType: 'QUERY',
      query: string,
    };

export const ActionTypes = Object.freeze({
  ACTIVE_PROVIDER_CHANGED: 'ACTIVE_PROVIDER_CHANGED',
  QUERY: 'QUERY',
});

// Flow hack: Every QuickSelectionAction actionType must be in ActionTypes.
// $FlowFixMe(>=0.55.0) Flow suppress
(('': $PropertyType<QuickSelectionAction, 'actionType'>): $Keys<
  typeof ActionTypes,
>);

export default class QuickSelectionDispatcher extends Dispatcher<
  QuickSelectionAction,
> {}
