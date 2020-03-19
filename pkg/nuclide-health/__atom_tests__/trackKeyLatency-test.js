/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
/* global requestAnimationFrame */

import {attachWorkspace} from 'nuclide-commons-atom/test-helpers';
import trackKeyLatency, {KEYSTROKES_TO_IGNORE} from '../lib/trackKeyLatency';
import {HistogramTracker} from 'nuclide-analytics';
import waitsFor from '../../../jest/waits_for';

beforeEach(() => {
  attachWorkspace();
});

const sleep = n => new Promise(r => setTimeout(r, n));

describe('trackKeyLatency', () => {
  it('is able to measure key latency', async () => {
    const trackSpy = jest.spyOn(HistogramTracker.prototype, 'track');
    const disposable = trackKeyLatency();

    const editor = await atom.workspace.open();
    await sleep(1000); // trigger the initial delay

    for (let i = 0; i < KEYSTROKES_TO_IGNORE + 1; i++) {
      editor.insertText('x');
    }

    await waitsFor(() => trackSpy.mock.calls.length === 2);

    expect(trackSpy.mock.calls.length).toBe(2);
    expect(trackSpy.mock.calls[0][0]).toBeLessThan(trackSpy.mock.calls[1][0]);
    disposable.dispose();
  });
});

// This is more of an assertion that the assumptions in trackKeyLatency hold up;
// in particular that an animation frame is enough to flush the DOM update.
describe('TextEditor', () => {
  it('updates the DOM after an animation frame', async () => {
    const editor = await atom.workspace.open();
    const insertText = '!!!!!';
    const innerHTMLPromise = new Promise(resolve => {
      editor.onDidChange(() => {
        setImmediate(() => {
          requestAnimationFrame(() => {
            resolve(editor.getElement().innerHTML);
          });
        });
      });
    });
    editor.insertText(insertText);
    expect(await innerHTMLPromise).toContain(insertText);
  });
});
