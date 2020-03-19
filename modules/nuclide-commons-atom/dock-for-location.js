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

// Return the dock for a pane if the pane is in a dock (i.e. not in the center.)
export default function dockForLocation(location: string): ?atom$Dock {
  switch (location) {
    case 'bottom':
      return atom.workspace.getBottomDock();
    case 'left':
      return atom.workspace.getLeftDock();
    case 'right':
      return atom.workspace.getRightDock();
  }
  return null;
}
