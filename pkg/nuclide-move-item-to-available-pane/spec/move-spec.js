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

import {activate} from '../lib/main';
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';

describe('nuclide-move-item-to-available-pane', () => {
  it('moves items across panes and creates new ones, as appropriate', () => {
    waitsForPromise(async () => {
      activate();

      await atom.workspace.open('A');
      await atom.workspace.open('B');
      await atom.workspace.open('C');
      atom.workspace.getPanes()[0].activateItemAtIndex(0);
      assertWorkspaceState(['A*', 'B', 'C']);

      dispatchCmdKRight();
      assertWorkspaceState(['B', 'C'], ['A*']);

      dispatchCmdKCmdLeft();
      assertWorkspaceState(['B*', 'C'], ['A']);

      dispatchCmdKRight();

      // TODO(mbolin): The rest of this test does not appear to run correctly because Atom does not
      // seem to layout the windows "for real," so the (x, y) ClientRect for each pane is reported
      // to be at (0, 0), which breaks the logic of nuclide-move-item-to-available-pane. If we can
      // figure out how to fix this, this would be a much better test. For now, we leave it here so
      // to illustrate the expected behavior.

      // assertWorkspaceState(['C'], ['A', 'B*']);
      //
      // dispatchCmdKRight();
      // assertWorkspaceState(['C'], ['A'], ['B*']);
      //
      // dispatchCmdKCmdLeft();
      // assertWorkspaceState(['C'], ['A*'], ['B']);
      //
      // dispatchCmdKLeft();
      // assertWorkspaceState(['C', 'A*'], ['B']);
      //
      // dispatchCmdKCmdRight();
      // assertWorkspaceState(['C', 'A'], ['B*']);
      //
      // dispatchCmdKLeft();
      // assertWorkspaceState(['C', 'A', 'B*']);
      //
      // dispatchCmdKLeft();
      // assertWorkspaceState(['B*'], ['C', 'A']);

      // TODO(mbolin): This is also an important test:

      // [A] [B, C*] [D]
      //
      // cmd-k down
      //
      // [A] [B] [D]
      //     [C*]
      //
      // cmd-k up
      //
      // [A] [B, C*] [D]
      //
      // Note that this test is necessary to verify that both the primaryComparator and
      // secondaryComparator are doing their job in move.js.
    });
  });
});

/**
 * Each descriptor represents the pane items that a pane should contain. Each
 * element of a descriptor corresponds to the name of the file that the pane
 * item should be displaying. If the element ends with an asterisk, that
 * indicates that it should be the active pane item.
 */
function assertWorkspaceState(...descriptors: Array<Array<string>>) {
  expect(createDescriptorForWorkspaceState()).toEqual(descriptors);
}

function createDescriptorForWorkspaceState(): Array<Array<string>> {
  const activeItem = atom.workspace.getActiveTextEditor();
  return atom.workspace.getPanes().map(pane => {
    return pane.getItems().map(item => {
      const fileName = item.getPath();
      let name = nuclideUri.basename(fileName);
      if (item === activeItem) {
        name += '*';
      }
      return name;
    });
  });
}

function dispatchCmdKRight() {
  const activeEditor = atom.workspace.getActiveTextEditor();
  invariant(activeEditor);
  const wasDispatched = atom.commands.dispatch(
    atom.views.getView(activeEditor),
    'nuclide-move-item-to-available-pane:right',
  );
  expect(wasDispatched).toBe(true);
}

// eslint-disable-next-line no-unused-vars
function dispatchCmdKLeft() {
  const activeEditor = atom.workspace.getActiveTextEditor();
  invariant(activeEditor);
  const wasDispatched = atom.commands.dispatch(
    atom.views.getView(activeEditor),
    'nuclide-move-item-to-available-pane:left',
  );
  expect(wasDispatched).toBe(true);
}

function dispatchCmdKCmdLeft() {
  // In test mode, the command appears to get dispatched successfully, but the focus does not get
  // updated properly, so we have to provide some help.
  const activePane = atom.workspace.getActivePane();
  const panes = atom.workspace.getPanes();
  const index = panes.indexOf(activePane);

  const activeEditor = atom.workspace.getActiveTextEditor();
  invariant(activeEditor);
  const wasDispatched = atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    'window:focus-pane-on-left',
  );
  expect(wasDispatched).toBe(true);

  const newIndex = Math.max(0, index - 1);
  panes[newIndex].activate();
}

// eslint-disable-next-line no-unused-vars
function dispatchCmdKCmdRight() {
  // In test mode, the command appears to get dispatched successfully, but the focus does not get
  // updated properly, so we have to provide some help.
  const activePane = atom.workspace.getActivePane();
  const panes = atom.workspace.getPanes();
  const index = panes.indexOf(activePane);

  const activeEditor = atom.workspace.getActiveTextEditor();
  invariant(activeEditor);
  const wasDispatched = atom.commands.dispatch(
    atom.views.getView(activeEditor),
    'window:focus-pane-on-right',
  );
  expect(wasDispatched).toBe(true);

  const newIndex = Math.min(panes.length - 1, index + 1);
  panes[newIndex].activate();
}
