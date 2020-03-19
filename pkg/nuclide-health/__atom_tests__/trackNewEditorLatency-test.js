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
import {HistogramTracker} from 'nuclide-analytics';
import trackNewEditorLatency from '../lib/trackNewEditorLatency';
import waitsFor from '../../../jest/waits_for';

describe('trackNewEditorLatency', () => {
  it('tracks latency of switching between editors', async () => {
    trackNewEditorLatency();
    const tracks = [];
    jest
      .spyOn(HistogramTracker.prototype, 'track')
      .mockImplementation(function(value) {
        tracks.push([this._eventName, value]);
      });
    await atom.workspace.open(__filename);
    await atom.workspace.open();
    await waitsFor(() => {
      return tracks.length > 0;
    });
    expect(tracks.length).toBe(2);
    expect(tracks[0][0]).toBe('open-editor');
    expect(tracks[1][0]).toBe('open-editor');
    // This needs to be separate (otherwise it blends into the 'add' event).
    await atom.workspace.open(__filename);
    await waitsFor(() => tracks.length > 2);
    expect(tracks.length).toBe(3);
    expect(tracks[2][0]).toBe('switch-editor');
  });
});
