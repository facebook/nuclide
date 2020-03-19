/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import {Range} from 'atom';
import fsPromise from 'nuclide-commons/fsPromise';
import {dispatchKeyboardEvent} from '../testHelpers';
import invariant from 'assert';

const attachToDom = el => {
  // Attach the workspace to the DOM so focus can be determined in tests below.
  const testContainer = document.createElement('div');
  invariant(document.body);
  document.body.appendChild(testContainer);
  testContainer.appendChild(el);
};

describe('dispatchKeyboardEvent', () => {
  it('sends copy and paste', async () => {
    const file = await fsPromise.tempfile();
    const editor = await atom.workspace.open(file);
    attachToDom(atom.views.getView(atom.workspace));
    // jasmine.attachToDOM();
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

  it('sends escape', async () => {
    await atom.workspace.open(await fsPromise.tempfile());
    attachToDom(atom.views.getView(atom.workspace));
    const events = [];
    atom.keymaps.onDidMatchBinding(event => events.push(event));

    // Hit escape key.
    dispatchKeyboardEvent('escape', document.activeElement);

    expect(events.length).toBe(1);
    expect(events[0].keystrokes).toBe('escape');
  });
});

describe('rangeMatchers', () => {
  describe('toEqualAtomRange', () => {
    it('determines when two Ranges are equal.', () => {
      expect(new Range([0, 0], [0, 0])).toEqual(new Range([0, 0], [0, 0]));
      expect(new Range([0, 0], [0, 0])).not.toEqual(new Range([1, 0], [0, 0]));
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
      expect(ranges).toEqual(sameRanges);
      expect(ranges).not.toEqual(differentRanges);
    });
  });
});
