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

import type {AppState} from '../types';

export function createEmptyAppState(
  hiddenTopics: Set<string>,
  overriddenDefaults: Object = {},
): AppState {
  return {
    topic: '',
    shouldHide: true,
    welcomePages: new Map(),
    hiddenTopics,
    isWelcomePageVisible: false,
  };
}
