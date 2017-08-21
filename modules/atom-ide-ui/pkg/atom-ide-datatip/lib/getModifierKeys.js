/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {ModifierKey} from './types';
import {ModifierKeys} from './types';

const KEYNAME_TO_PROPERTY = {
  Meta: ModifierKeys.META,
  Shift: ModifierKeys.SHIFT,
  Alt: ModifierKeys.ALT,
  Control: ModifierKeys.CTRL,
};

export function getModifierKeysFromMouseEvent(e: MouseEvent): Set<ModifierKey> {
  const keys: Set<ModifierKey> = new Set();
  if (e.metaKey) {
    keys.add(ModifierKeys.META);
  }
  if (e.shiftKey) {
    keys.add(ModifierKeys.SHIFT);
  }
  if (e.altKey) {
    keys.add(ModifierKeys.ALT);
  }
  if (e.ctrlKey) {
    keys.add(ModifierKeys.CTRL);
  }

  return keys;
}

export function getModifierKeyFromKeyboardEvent(
  e: KeyboardEvent,
): ?ModifierKey {
  return KEYNAME_TO_PROPERTY[e.key];
}
