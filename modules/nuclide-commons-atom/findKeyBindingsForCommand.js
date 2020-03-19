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

import humanizeKeystroke from 'nuclide-commons/humanizeKeystroke';

/**
 * Determine what the applicable shortcut for a given command is within this component's context.
 * For example, this will return different keybindings on windows vs linux.
 */
export default function findKeyBindingsForCommand(
  command: string,
  target?: HTMLElement = atom.views.getView(atom.workspace),
): string {
  const matchingKeyBindings = atom.keymaps.findKeyBindings({command, target});
  const keystroke =
    (matchingKeyBindings.length && matchingKeyBindings[0].keystrokes) || '';
  return humanizeKeystroke(keystroke, process.platform);
}
