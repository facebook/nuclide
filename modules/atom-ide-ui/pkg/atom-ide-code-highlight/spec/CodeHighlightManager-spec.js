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

import os from 'os';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Point, Range} from 'atom';

import CodeHighlightManager from '../lib/CodeHighlightManager';

describe('CodeHighlightManager', () => {
  let manager;
  let provider;
  let editor;
  beforeEach(() => {
    jasmine.useMockClock();
    waitsForPromise(async () => {
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
  });

  it('updates highlights on cursor move', () => {
    const ranges = [new Range([0, 0], [0, 3])];
    const spy = spyOn(provider, 'highlight').andReturn(ranges);

    // Just opening the editor should trigger highlights.
    runs(() => {
      advanceClock(1); // editor debounce
      advanceClock(300);
      expect(spy).toHaveBeenCalled();
    });

    // (once the promise resolves).
    waitsFor(() => manager._markers.length === 1);

    runs(() => {
      ranges[0] = new Range([1, 0], [1, 3]);
      editor.setCursorBufferPosition(new Point(1, 0));
      // Old markers should be cleared immediately.
      expect(manager._markers.length).toBe(0);
      advanceClock(300); // trigger debounce
      expect(spy.callCount).toBe(2);
    });

    waitsFor(() => manager._markers.length === 1);

    // If we're still inside the range, don't fire a new event.
    runs(() => {
      editor.setCursorBufferPosition(new Point(1, 1));
      expect(spy.callCount).toBe(2);
    });

    waitsForPromise(() =>
      atom.workspace.open(nuclideUri.join(os.tmpdir(), 'test2.txt')),
    );

    runs(() => {
      // Opening a new editor should clear out old markers.
      advanceClock(1);
      expect(manager._markers.length).toBe(0);
    });
  });

  it('updates highlights on change', () => {
    const ranges = [new Range([0, 0], [0, 1])];
    const spy = spyOn(provider, 'highlight').andReturn(ranges);

    runs(() => {
      advanceClock(1);
      editor.insertText('a');
      advanceClock(300); // trigger debounce
      expect(spy).toHaveBeenCalled();
    });

    // Wait for the promise to resolve.
    waitsFor(() => manager._markers.length === 1);

    runs(() => {
      editor.insertText('b');
      // Clear out immediately.
      expect(manager._markers.length).toBe(0);
    });
  });
});
