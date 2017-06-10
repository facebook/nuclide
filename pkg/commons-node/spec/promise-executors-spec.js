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

import {PromisePool, PromiseQueue} from '../promise-executors';

describe('PromiseQueue', () => {
  // Workarounds to enable setTimeout, as suggested by:
  // https://discuss.atom.io/t/solved-settimeout-not-working-firing-in-specs-tests/11427/17
  beforeEach(() => {
    jasmine.useRealClock();
  });

  it('Run three async operations serially and make sure they do not overlap.', () => {
    const queue = new PromiseQueue();
    let res1Start = 0;
    let res1End = 0;
    let res2Start = 0;
    let res2End = 0;
    let res3Start = 0;
    let res3End = 0;

    runs(() => {
      queue.submit(async () => {
        res1Start = Date.now();
        await new Promise(resolve => {
          setTimeout(() => {
            resolve((res1End = Date.now()));
          }, 100);
        });
      });
      queue.submit(async () => {
        res2Start = Date.now();
        await new Promise(resolve => {
          setTimeout(() => {
            resolve((res2End = Date.now()));
          }, 200);
        });
      });
      queue.submit(async () => {
        res3Start = Date.now();
        await new Promise(resolve => {
          setTimeout(() => {
            resolve((res3End = Date.now()));
          }, 300);
        });
      });
    });

    waitsFor(() => res1End && res2End && res3End, 700);

    runs(() => {
      // Make sure that none of the executors overlapped.
      expect(res1Start).not.toBeGreaterThan(res1End);
      expect(res1End).not.toBeGreaterThan(res2Start);
      expect(res2Start).not.toBeGreaterThan(res2End);
      expect(res2End).not.toBeGreaterThan(res3Start);
      expect(res3Start).not.toBeGreaterThan(res3End);
    });
  });
});

describe('PromisePool', () => {
  beforeEach(() => {
    jasmine.useRealClock();
  });

  it('Run async operations in parallel and do not exceed pool size.', () => {
    const poolSize = 3;
    const numDelayedExecutors = 30;
    const delayMs = 10;
    let numRunning = 0;

    const executors = [];
    for (let i = 0; i < numDelayedExecutors; i++) {
      executors.push(async () => {
        numRunning++;
        expect(numRunning <= poolSize).toBe(true);
        await new Promise(resolve => {
          setTimeout(() => {
            expect(numRunning <= poolSize).toBe(true);
            numRunning--;
            resolve();
          }, delayMs);
        });
      });
    }

    const queue = new PromisePool(poolSize);

    waitsForPromise(async () => {
      const start = Date.now();
      await Promise.all(executors.map(executor => queue.submit(executor)));
      const end = Date.now();
      expect(end - start).toBeLessThan(
        numDelayedExecutors * delayMs / (poolSize - 1),
      );
    });
  });
});
