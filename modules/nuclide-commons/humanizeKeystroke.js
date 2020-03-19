/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

/*
 * adapted from https://github.com/atom/underscore-plus/blob/master/src/underscore-plus.coffee
 */

const MAC_MODIFIER_KEYMAP = {
  alt: '\u2325',
  cmd: '\u2318',
  ctrl: '\u2303',
  down: '\u2193',
  enter: '\u23ce',
  left: '\u2190',
  option: '\u2325',
  right: '\u2192',
  shift: '\u21e7',
  up: '\u2191',
};

const NON_MAC_MODIFIER_KEYMAP = {
  alt: 'Alt',
  cmd: 'Cmd',
  ctrl: 'Ctrl',
  down: 'Down',
  enter: 'Enter',
  left: 'Left',
  option: 'Alt',
  right: 'Right',
  shift: 'Shift',
  up: 'Up',
};

// Human key combos should always explicitly state the shift key. This map is a disambiguator.
// 'shift-version': 'no-shift-version'
const SHIFT_KEYMAP = {
  _: '-',
  ':': ';',
  '?': '/',
  '"': "'",
  '{': '[',
  '}': ']',
  '+': '=',
  '<': ',',
  '>': '.',
  '|': '\\',
  '~': '`',
};

const FN_KEY_RE = /f[0-9]{1,2}/;

// $FlowIssue
function flatten<T>(arr: Array<T | Array<T>>): Array<T> {
  let flattened = [];
  for (const el of arr) {
    if (Array.isArray(el)) {
      flattened = flattened.concat(flatten(el));
    } else {
      flattened.push(el);
    }
  }
  return flattened;
}

function capitalize(word: string): string {
  const first = word[0] || '';
  const rest = word.slice(1);
  return first.toUpperCase() + rest;
}

function humanizeKey(key: string, platform: ?string): string | Array<string> {
  if (!key) {
    return key;
  }
  const modifierKeyMap =
    platform === 'darwin' ? MAC_MODIFIER_KEYMAP : NON_MAC_MODIFIER_KEYMAP;
  if (modifierKeyMap[key]) {
    return modifierKeyMap[key];
  }
  if (key.length === 1) {
    if (SHIFT_KEYMAP[key]) {
      return [modifierKeyMap.shift, SHIFT_KEYMAP[key]];
    }
    const uppercase = key.toUpperCase();
    if (key === uppercase && uppercase !== key.toLowerCase()) {
      return [modifierKeyMap.shift, uppercase];
    }
    return uppercase;
  }
  if (FN_KEY_RE.test(key)) {
    return key.toUpperCase();
  }
  return platform === 'darwin' ? key : capitalize(key);
}

/**
 * Humanize the keystroke according to platform conventions. This method
 * attempts to mirror the text the given keystroke would have if displayed in
 * a system menu.
 *
 * @param keystroke A String keystroke to humanize such as `ctrl-O`.
 * @param platform An optional String platform to humanize for (default: `process.platform`).
 * @return a humanized representation of the keystroke.
 */
export default function humanizeKeystroke(
  keystroke: string,
  platform_: ?string,
): string {
  let platform = platform_;
  if (!keystroke) {
    return keystroke;
  }
  // flowlint-next-line sketchy-null-string:off
  platform = platform || process.platform;
  const separator = platform === 'darwin' ? '' : '+';
  let key;
  let keys;
  let splitKeystroke;
  const keystrokes = keystroke.split(' ');
  const humanizedKeystrokes = [];
  for (let i = 0; i < keystrokes.length; i++) {
    const currentKeystroke = keystrokes[i];
    splitKeystroke = currentKeystroke.split('-');
    keys = [];
    for (let index = 0; index < splitKeystroke.length; index++) {
      key = splitKeystroke[index];
      if (key === '' && splitKeystroke[index - 1] === '') {
        key = '-';
      }
      if (key) {
        keys.push(humanizeKey(key, platform));
      }
    }
    keys = Array.from(new Set(flatten(keys)));
    humanizedKeystrokes.push(keys.join(separator));
  }
  return humanizedKeystrokes.join(' ');
}
