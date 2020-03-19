/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

/**
 * Helps to easily poll in integration tests for a DOM (or any other) change.
 *
 * Meant to be used inside a `waitsForPromise` block.
 * If the predicate is not fulfilled within the maxWaitTime period, will reject the promise
 * and fail an `expect` call to produce a readable error.
 *
 * NOTE: The surrounding waitsForPromise has a timeout of its own, be sure to set it to a value
 * higher than the `maxWaitTime`
 *
 * Usage:
 * async function fileTreeHasFinishedLoading(): Promise<void> {
 *   await pollFor(() => {
 *     const cssSelector = '.nuclide-file-tree .list-tree.has-collapsable-children li.loading';
 *     return document.body.querySelectorAll(cssSelector).length === 0;
 *   },
 *   'File tree did not finish loading',
 *   );
 * }
 */
export default function pollFor(
  predicate: () => boolean,
  errorMessage: ?string = null,
  maxWaitTime: number = 1000,
  periodicity: number = 100,
): Promise<void> {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const periodicCheck = () => {
      const res = predicate();
      if (res) {
        expect(res).toBe(true); // For the assertion count
        resolve();
      } else {
        if (Date.now() - startTime < maxWaitTime) {
          setTimeout(periodicCheck, periodicity);
        } else {
          if (errorMessage != null) {
            expect('polling').toBe(`finished by now. ${errorMessage}`);
            reject(new Error(errorMessage));
          } else {
            expect('polling').toBe('finished by now');
            reject(new Error('pollFor timeout'));
          }
        }
      }
    };

    periodicCheck();
  });
}
