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

import type {ModifierKey} from './types';
import {ModifierKeys} from './types';

import Immutable from 'immutable';

const KEYNAME_TO_PROPERTY = {
  Meta: ModifierKeys.META,
  Shift: ModifierKeys.SHIFT,
  Alt: ModifierKeys.ALT,
  Control: ModifierKeys.CTRL,
};

export function getModifierKeysFromMouseEvent(
  e: MouseEvent,
): Immutable.Set<ModifierKey> {
  let keys: Immutable.Set<ModifierKey> = new Immutable.Set();
  if (e.metaKey) {
    keys = keys.add(ModifierKeys.META);
  }
  if (e.shiftKey) {
    keys = keys.add(ModifierKeys.SHIFT);
  }
  if (e.altKey) {
    keys = keys.add(ModifierKeys.ALT);
  }
  if (e.ctrlKey) {
    keys = keys.add(ModifierKeys.CTRL);
  }

  return keys;
}

export function getModifierKeyFromKeyboardEvent(
  e: KeyboardEvent,
): ?ModifierKey {
  return KEYNAME_TO_PROPERTY[e.key];
}
