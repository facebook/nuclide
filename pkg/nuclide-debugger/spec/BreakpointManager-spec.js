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

import {DebuggerStore} from '../lib/DebuggerStore';
import DebuggerActions from '../lib/DebuggerActions';
import DebuggerDispatcher from '../lib/DebuggerDispatcher';
import BreakpointManager from '../lib/BreakpointManager';
import BreakpointStore from '../lib/BreakpointStore';
import {hasBreakpointDecorationInRow} from './utils';
import * as utils from './utils';
import invariant from 'assert';

describe('BreakpointManager', () => {
  let breakpointManager;
  let breakpointStore;
  let dispatcher;
  let actions;
  let store;

  beforeEach(() => {
    dispatcher = new DebuggerDispatcher();
    const mockModel = ({}: any);
    store = new DebuggerStore(dispatcher, mockModel);
    breakpointStore = new BreakpointStore(dispatcher, null, store);
    actions = new DebuggerActions(dispatcher, store);
    breakpointManager = new BreakpointManager(breakpointStore, actions);
  });

  it('should display existing breakpoints in editor when it is opened', () => {
    waitsForPromise(async () => {
      const path = utils.getUniquePath();
      breakpointStore._addBreakpoint(path, 0);
      const editor = await atom.workspace.open(path);
      expect(hasBreakpointDecorationInRow(editor, 0)).toBe(true);
    });
  });

  it('should clean up breakpoint display for an editor when the editor is closed', () => {
    waitsForPromise(async () => {
      const uniqueEditor = await utils.createEditorWithUniquePath();
      const path = uniqueEditor.getPath();
      invariant(path);
      breakpointStore._addBreakpoint(path, 1);
      const editor = await atom.workspace.open(path);
      expect(hasBreakpointDecorationInRow(editor, 0)).toBe(true);
      expect(breakpointManager.getDisplayControllers().size).toBe(1);

      const pane = atom.workspace.paneForItem(editor);
      invariant(pane != null);
      pane.destroyItem(editor);
      expect(breakpointManager.getDisplayControllers().size).toBe(0);

      // But the store should still remember the breakpoint
      expect(breakpointStore.getBreakpointLinesForPath(path)).toEqual(
        new Set([1]),
      );
    });
  });
});
