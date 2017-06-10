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

import type {Observable} from 'rxjs';

import {
  copyFixture,
  copyBuildFixture,
  generateHgRepo1Fixture,
  generateHgRepo2Fixture,
  generateFixture,
} from './fixtures';
import {addMatchers} from './matchers';

/**
 * Verifies that a Promise fails with an Error with specific expectations. When
 * running a test where a Promise is expected to fail, it is important to verify
 * that it failed in the expected way to avoid false positives in test results.
 *
 * This function should be used with `await` inside `waitsForPromise()`.
 *
 * @param promise will be awaited. It is expected to reject. If it does not
 *     reject, then this function will return a rejected Promise.
 * @param verify should confirm expectations about the Error produced by the
 *     rejection of `promise`. If these expectations are not met, then
 *     `verify()` must throw an exception.
 */
async function expectAsyncFailure(
  promise: Promise<any>,
  verify: (error: Error) => void,
): Promise<any> {
  try {
    await promise;
    return Promise.reject(
      new Error('Promise should have failed, but did not.'),
    );
  } catch (e) {
    verify(e);
  }
}

/**
  * This is useful for mocking a module that the module under test requires.
  * After setting up the mocks, you must invalidate the require cache and then
  * re-require the module under test so that it picks up the mocked
  * dependencies.
  *
  * The require parameter is needed because require is bound differently in each
  * file, and we need to execute this in the caller's context.
  */
function clearRequireCache(require: Object, module: string): void {
  delete require.cache[require.resolve(module)];
}

function uncachedRequire(require: Object, module: string): mixed {
  clearRequireCache(require, module);
  // $FlowIgnore
  return require(module);
}

/**
 * Jasmine has trouble spying on properties supplied by getters, so to make it
 * work we have to get the value, delete the getter, and set the value as a
 * property.
 *
 * This makes two assumptions:
 * - The getter is idempotent (otherwise, callers in other tests might be
 *   surprised when the value here is returned)
 * - The getter returns a function (otherwise, it doesn't make sense to spy on
 *   it)
 */
function spyOnGetterValue(object: Object, f: string): JasmineSpy {
  const value = object[f];
  delete object[f];
  object[f] = value;
  return spyOn(object, f);
}

/**
 * Checks if the two objects have equal properties. This considers a property
 * set to undefined to be equivalent to a property that was not set at all.
 */
function arePropertiesEqual(obj1: Object, obj2: Object): boolean {
  const allProps = new Set();
  function addAllProps(obj) {
    for (const prop of Object.keys(obj)) {
      allProps.add(prop);
    }
  }
  [obj1, obj2].forEach(addAllProps);
  for (const prop of allProps) {
    if (obj1[prop] !== obj2[prop]) {
      return false;
    }
  }
  return true;
}

/**
 * Warning: Callsites *must* await the resulting promise, or test failures may go unreported or
 * misattributed.
 */
async function expectObservableToStartWith<T>(
  source: Observable<T>,
  expected: Array<T>,
): Promise<void> {
  const actual: Array<T> = await source
    .take(expected.length)
    .toArray()
    .toPromise();
  expect(actual).toEqual(expected);
}

export {
  addMatchers,
  arePropertiesEqual,
  clearRequireCache,
  copyFixture,
  copyBuildFixture,
  expectAsyncFailure,
  expectObservableToStartWith,
  generateHgRepo1Fixture,
  generateHgRepo2Fixture,
  generateFixture,
  spyOnGetterValue,
  uncachedRequire,
};
