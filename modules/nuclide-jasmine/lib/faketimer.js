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

/**
 * Port of Atom's timer utils (https://fburl.com/104714454) which is useful for unittest.
 * Use fakeSetTimeout, fakeClearTimeout, fakeSetInterval and fakeClearInterval to mock Node.js's
 * Timer utils, and using advanceClock to advance the fake timer to trigger timed callback.
 */
require('jasmine-node'); // eslint-disable-line nuclide-internal/no-commonjs

let now = 0;
let timeoutCount = 0;
let intervalCount = 0;
let timeouts = [];
let intervalTimeouts = {};

function resetTimeouts(): void {
  now = 0;
  timeoutCount = 0;
  intervalCount = 0;
  timeouts = [];
  intervalTimeouts = {};
}

function fakeSetTimeout(callback: () => ?any, ms: number): number {
  const id = ++timeoutCount;
  timeouts.push([id, now + ms, callback]);
  timeouts.sort(
    ([, strikeTime0], [, strikeTime1]) => strikeTime0 - strikeTime1,
  );
  return id;
}

function fakeClearTimeout(idToClear: number): void {
  timeouts = timeouts.filter(([id]) => id !== idToClear);
}

function fakeSetInterval(callback: () => ?any, ms: number): number {
  const id = ++intervalCount;
  const action = () => {
    callback();
    intervalTimeouts[id] = fakeSetTimeout(action, ms);
  };
  intervalTimeouts[id] = fakeSetTimeout(action, ms);
  return id;
}

function fakeClearInterval(idToClear: number): void {
  fakeClearTimeout(intervalTimeouts[idToClear]);
}

function advanceClock(deltaMs: number): void {
  const advanceTo = now + deltaMs;

  while (timeouts.length !== 0 && timeouts[0][1] <= advanceTo) {
    const [, strikeTime, callback] = timeouts.shift();
    now = strikeTime;
    callback();
  }

  now = advanceTo;
}

/**
 * Allows tests to use the non-fake setTimeout and clearTimeout functions.
 */
function useRealClock(): void {
  jasmine.unspy(global, 'setTimeout');
  jasmine.unspy(global, 'clearTimeout');
  jasmine.unspy(Date, 'now');
}

/**
 * Atom does this half-way mock.
 * https://github.com/atom/atom/blob/v1.12.7/spec/spec-helper.coffee#L169-L174
 */
function useMockClock(): void {
  spyOn(global, 'setInterval').andCallFake(fakeSetInterval);
  spyOn(global, 'clearInterval').andCallFake(fakeClearInterval);
}

// Expose the fake timer utils to global to be used by npm spec tests.
global.resetTimeouts = resetTimeouts;
global.fakeSetTimeout = fakeSetTimeout;
global.fakeClearTimeout = fakeClearTimeout;
global.fakeSetInterval = fakeSetInterval;
global.fakeClearInterval = fakeClearInterval;
global.advanceClock = advanceClock;
jasmine.useRealClock = useRealClock;
jasmine.useMockClock = useMockClock;
// $FlowIssue: https://github.com/facebook/flow/issues/285
Object.defineProperty(global, 'now', {get: () => now});

/**
 * This hook is a the first initialization code that happens before any jasmine test case is
 * executed. This allows to use the fake timing by default and is a direct port from Atom's
 * `spec-helper.coffee`
 */
beforeEach(() => {
  resetTimeouts();
  spyOn(Date, 'now').andCallFake(() => now);
  spyOn(global, 'setTimeout').andCallFake(fakeSetTimeout);
  spyOn(global, 'clearTimeout').andCallFake(fakeClearTimeout);
});
