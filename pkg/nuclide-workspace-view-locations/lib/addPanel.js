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

type PanelLocation = 'top' | 'right' | 'bottom' | 'left';

export default function addPanel(
  location: PanelLocation,
  options: atom$WorkspaceAddPanelOptions,
): atom$Panel {
  switch (location) {
    case 'top':
      return atom.workspace.addTopPanel(options);
    case 'right':
      return atom.workspace.addRightPanel(options);
    case 'bottom':
      return atom.workspace.addBottomPanel(options);
    case 'left':
      return atom.workspace.addLeftPanel(options);
    default:
      throw new Error(`Invalid location: ${location}`);
  }
}
