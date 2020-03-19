/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {getWordFromCursorOrSelection} from '../range';

describe('getWordFromCursorOrSelection', () => {
  it('matches a word in an editor from a selection before cursor', async () => {
    const editor = await atom.workspace.open();
    editor.setText('Darmok and Jalad\nat Tanagra.');

    editor.addCursorAtBufferPosition([1, 4]);
    editor.setSelectedBufferRange([[0, 7], [0, 10]]);
    const word = getWordFromCursorOrSelection(editor);
    expect(word).toBe('and');
  });

  it('matches a word in an editor from a cursor position', async () => {
    const editor = await atom.workspace.open();
    editor.setText('Darmok and Jalad\nat Tanagra.');

    editor.addCursorAtBufferPosition([1, 4]);
    const word = getWordFromCursorOrSelection(editor);
    expect(word).toBe('Tanagra');
  });

  it('does not match a word without a cursor or selection', async () => {
    const editor = await atom.workspace.open();

    const word = getWordFromCursorOrSelection(editor);
    expect(word).toBeNull();
  });
});
