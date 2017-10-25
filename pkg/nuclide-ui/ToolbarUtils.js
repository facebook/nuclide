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
import humanizeKeystroke from '../commons-node/humanizeKeystroke';

export function makeToolbarButtonSpec(
  options: toolbar$ButtonSpec,
): toolbar$ButtonSpec {
  const command = options.callback;
  if (typeof command === 'string') {
    const [keyBinding] = atom.keymaps.findKeyBindings({
      command,
      target: atom.views.getView(atom.workspace),
    });
    const tooltipStr = options.tooltip;
    if (keyBinding != null && tooltipStr != null) {
      const keyString = humanizeKeystroke(keyBinding.keystrokes, null);
      options.tooltip = `${tooltipStr} (${keyString})`;
    }
  }

  return {...options};
}
