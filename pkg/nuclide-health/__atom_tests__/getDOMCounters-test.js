/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';
import {remote} from 'electron';
import {getLogger} from 'log4js';
import getDOMCounters from '../lib/getDOMCounters';

invariant(remote != null);

describe('getDOMCounters', () => {
  it('returns reasonable values', async () => {
    const counters = await getDOMCounters();
    invariant(counters != null, 'Expected non-null counters');
    expect(counters.nodes).toBeGreaterThan(10);
    expect(counters.attachedNodes).toBeLessThan(counters.nodes);
    expect(counters.jsEventListeners).toBeGreaterThan(10);
    getLogger().debug('getDOMCounters():', JSON.stringify(counters));
  });

  it('returns null if a debugger is attached', async () => {
    const chromeDebugger = remote.getCurrentWebContents().debugger;
    invariant(chromeDebugger != null);

    chromeDebugger.attach('1.1');
    const counters = await getDOMCounters();
    expect(counters).toBeNull();
    chromeDebugger.detach();
  });
});
