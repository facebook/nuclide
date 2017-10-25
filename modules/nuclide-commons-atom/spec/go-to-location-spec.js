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

import {Point} from 'atom';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {goToLocation, observeNavigatingEditors} from '../go-to-location';
import {jasmineAttachWorkspace} from '../test-helpers';

const FILE1_PATH = nuclideUri.join(__dirname, 'fixtures/file1.txt');
const FILE2_PATH = nuclideUri.join(__dirname, 'fixtures/file2.txt');

describe('goToLocation', () => {
  beforeEach(() => {
    jasmineAttachWorkspace();
    atom.workspace.getTextEditors().forEach(editor => {
      editor.destroy();
    });
  });

  it('should work with nothing open', () => {
    waitsForPromise(async () => {
      const editor = await goToLocation(FILE1_PATH);
      expect(editor.getPath()).toBe(FILE1_PATH);
      expect(atom.workspace.getActiveTextEditor()).toBe(editor);
    });
  });

  it('should open the current file successfully', () => {
    waitsForPromise(async () => {
      const editor1 = await goToLocation(FILE1_PATH);
      const editor2 = await goToLocation(FILE1_PATH);
      expect(editor1).toBe(editor2);
      expect(editor1.getPath()).toBe(FILE1_PATH);
      expect(atom.workspace.getActiveTextEditor()).toBe(editor1);
    });
  });

  it('should re-use the editor for an already-open file', () => {
    waitsForPromise(async () => {
      const editor1 = await goToLocation(FILE1_PATH);
      const editor2 = await goToLocation(FILE2_PATH);
      expect(atom.workspace.getActiveTextEditor()).toBe(editor2);

      const editor3 = await goToLocation(FILE1_PATH);
      expect(editor1).toBe(editor3);
      expect(atom.workspace.getActiveTextEditor()).toBe(editor1);
    });
  });

  it('should search other panes for an editor for this file', () => {
    waitsForPromise(async () => {
      const editor1 = await atom.workspace.open(FILE1_PATH);
      const editor2 = await atom.workspace.open(FILE2_PATH, {split: 'right'});
      expect(atom.workspace.getActiveTextEditor()).toBe(editor2);
      expect(atom.workspace.paneForItem(editor1)).not.toBe(
        atom.workspace.paneForItem(editor2),
      );

      const editor3 = await goToLocation(FILE1_PATH);
      expect(atom.workspace.getActiveTextEditor()).toBe(editor3);
      expect(editor3).toBe(editor1);
    });
  });

  it('should correctly set the cursor position when opening a file', () => {
    waitsForPromise(async () => {
      const editor = await goToLocation(FILE1_PATH, {line: 1, column: 3});
      expect(editor.getCursorBufferPosition()).toEqual(new Point(1, 3));
    });
  });

  it('should correctly set the cursor position when opening an already-open file', () => {
    waitsForPromise(async () => {
      const editor1 = await atom.workspace.open(FILE1_PATH);
      expect(editor1.getCursorBufferPosition()).toEqual(new Point(0, 0));

      const editor2 = await goToLocation(FILE1_PATH, {line: 1, column: 3});
      expect(editor2).toBe(editor1);
      expect(editor1.getCursorBufferPosition()).toEqual(new Point(1, 3));
    });
  });

  it('focuses the editor', () => {
    waitsForPromise(async () => {
      const editor1 = await atom.workspace.open(FILE1_PATH);
      const dock = atom.workspace.getLeftDock();
      dock.activate();
      expect(dock.getElement().contains(document.activeElement)).toBe(true);
      const editor2 = await goToLocation(FILE1_PATH, {line: 0, column: 0});
      expect(editor2).toBe(editor1);
      expect(editor1.getElement().contains(document.activeElement)).toBe(true);
    });
  });

  describe('its effect on observeNavigatingEditors', () => {
    let navigatingEditorsArray: Array<atom$TextEditor> = (null: any);
    let subscription: rxjs$ISubscription = (null: any);

    beforeEach(() => {
      navigatingEditorsArray = [];
      subscription = observeNavigatingEditors().subscribe(editor => {
        navigatingEditorsArray.push(editor);
      });
    });
    afterEach(() => {
      subscription.unsubscribe();
    });

    it('should not publish when opening a new file', () => {
      waitsForPromise(async () => {
        await goToLocation(FILE1_PATH, {line: 1, column: 2});
        expect(navigatingEditorsArray).toEqual([]);
      });
    });

    it('should not publish when opening the current editor with no position', () => {
      waitsForPromise(async () => {
        await goToLocation(FILE1_PATH);
        await goToLocation(FILE1_PATH);
        expect(navigatingEditorsArray).toEqual([]);
      });
    });

    it('should publish when opening the current file with a position', () => {
      waitsForPromise(async () => {
        const editor1 = await goToLocation(FILE1_PATH, {line: 1, column: 2});
        expect(navigatingEditorsArray).toEqual([]);
        const editor2 = await goToLocation(FILE1_PATH, {line: 1, column: 2});
        expect(editor2).toBe(editor1);
        expect(navigatingEditorsArray).toEqual([editor1]);
        expect(editor1.getCursorBufferPosition()).toEqual(new Point(1, 2));
      });
    });

    it('should not publish when opening a file that is already open but not focused', () => {
      waitsForPromise(async () => {
        await goToLocation(FILE1_PATH, {line: 1, column: 2});
        await goToLocation(FILE2_PATH, {line: 1, column: 2});
        await goToLocation(FILE1_PATH, {line: 1, column: 2});
        expect(navigatingEditorsArray).toEqual([]);
      });
    });
  });
});
