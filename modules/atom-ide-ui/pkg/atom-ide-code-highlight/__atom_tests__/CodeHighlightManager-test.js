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
import os from 'os';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Point, Range} from 'atom';
import waitsFor from '../../../../../jest/waits_for';
import {sleep} from 'nuclide-commons/promise';

import CodeHighlightManager from '../lib/CodeHighlightManager';

describe('CodeHighlightManager', () => {
  let manager;
  let provider;
  let editor;
  beforeEach(async () => {
    jest.restoreAllMocks();
    editor = await atom.workspace.open(
      nuclideUri.join(os.tmpdir(), 'test.txt'),
    );
    editor.setText('abc\ndef\nghi');

    manager = new CodeHighlightManager();
    provider = {
      priority: 1,
      grammarScopes: ['text.plain.null-grammar'],
      highlight: (_editor, position) => Promise.resolve([]),
    };
    manager.addProvider(provider);
  });

  it.skip('updates highlights on cursor move', async () => {
    const ranges = [new Range([0, 0], [0, 3])];
    const spy = jest.spyOn(provider, 'highlight').mockReturnValue(ranges);

    // Just opening the editor should trigger highlights.
    await sleep(1); // editor debounce
    expect(spy).toHaveBeenCalled();

    // (once the promise resolves).
    await waitsFor(() => manager._markers.length === 1);

    ranges[0] = new Range([1, 0], [1, 3]);
    editor.setCursorBufferPosition(new Point(1, 0));
    await sleep(300); // trigger debounce
    // Old markers should be cleared immediately.
    expect(manager._markers.length).toBe(0);
    expect(spy.mock.calls.length).toBe(2);

    await waitsFor(() => manager._markers.length === 1);

    // If we're still inside the range, don't fire a new event.
    editor.setCursorBufferPosition(new Point(1, 1));
    expect(spy.mock.calls.length).toBe(2);

    atom.workspace.open(nuclideUri.join(os.tmpdir(), 'test2.txt'));

    // Opening a new editor should clear out old markers.
    await sleep(1);
    expect(manager._markers.length).toBe(0);
  });

  it('updates highlights on change', async () => {
    const ranges = [new Range([0, 0], [0, 1])];
    const spy = jest.spyOn(provider, 'highlight').mockReturnValue(ranges);

    await sleep(1);
    editor.insertText('a');
    await sleep(3000); // trigger typing debounce
    expect(spy).toHaveBeenCalled();

    // Wait for the promise to resolve.
    await waitsFor(() => manager._markers.length === 1);

    editor.insertText('b');
    // Clear out immediately.
    expect(manager._markers.length).toBe(0);
  });
});
