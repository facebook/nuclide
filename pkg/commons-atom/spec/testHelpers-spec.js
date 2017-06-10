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

import {Range} from 'atom';
import {dispatchKeyboardEvent, rangeMatchers} from '../testHelpers';

describe('dispatchKeyboardEvent', () => {
  it('sends copy and paste', () => {
    waitsForPromise(async () => {
      const editor = await atom.workspace.open('file.txt');
      jasmine.attachToDOM(atom.views.getView(atom.workspace));
      editor.insertText('text');
      const events = [];
      atom.keymaps.onDidMatchBinding(event => events.push(event));

      // Copy line.
      dispatchKeyboardEvent('c', document.activeElement, {cmd: true});
      // Paste copied line.
      dispatchKeyboardEvent('v', document.activeElement, {cmd: true});

      expect(events.length).toBe(2);
      expect(events[0].keystrokes).toBe('cmd-c');
      expect(events[1].keystrokes).toBe('cmd-v');
      expect(editor.getText()).toBe('texttext');
    });
  });

  it('sends escape', () => {
    waitsForPromise(async () => {
      await atom.workspace.open('file.txt');
      jasmine.attachToDOM(atom.views.getView(atom.workspace));
      const events = [];
      atom.keymaps.onDidMatchBinding(event => events.push(event));

      // Hit escape key.
      dispatchKeyboardEvent('escape', document.activeElement);

      expect(events.length).toBe(1);
      expect(events[0].keystrokes).toBe('escape');
    });
  });
});

describe('rangeMatchers', () => {
  beforeEach(function() {
    this.addMatchers(rangeMatchers);
  });

  describe('toEqualAtomRange', () => {
    it('determines when two Ranges are equal.', () => {
      expect(new Range([0, 0], [0, 0])).toEqualAtomRange(
        new Range([0, 0], [0, 0]),
      );
      expect(new Range([0, 0], [0, 0])).not.toEqualAtomRange(
        new Range([1, 0], [0, 0]),
      );
    });
  });

  describe('toEqualAtomRanges', () => {
    it('determines when two arrays of Ranges are equal.', () => {
      const ranges = [new Range([0, 0], [0, 0]), new Range([1, 1], [1, 1])];
      const sameRanges = [new Range([0, 0], [0, 0]), new Range([1, 1], [1, 1])];
      const differentRanges = [
        new Range([0, 0], [0, 0]),
        new Range([2, 2], [2, 2]),
      ];
      expect(ranges).toEqualAtomRanges(sameRanges);
      expect(ranges).not.toEqualAtomRanges(differentRanges);
    });
  });
});
