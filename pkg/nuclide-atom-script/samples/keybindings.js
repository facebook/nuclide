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

/* eslint-disable no-console */

import type {ExitCode} from '../lib/types';

export default (async function runCommand(
  args: Array<string>,
): Promise<ExitCode> {
  const commands = [];
  for (const keybinding of atom.keymaps.getKeyBindings()) {
    commands.push(keybinding.command);
  }

  commands.sort();
  commands.forEach(command => console.log(command));
  return 0;
});
