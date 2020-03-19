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

import type {Observable} from 'rxjs';

import invariant from 'assert';
import fs from 'fs';
import temp from 'temp';
import uuid from 'uuid';
import fsPromise from './fsPromise';
import nuclideUri from './nuclideUri';
import {asyncLimit} from './promise';

invariant(
  (typeof atom !== 'undefined' && atom.inSpecMode()) ||
    process.env.NODE_ENV === 'test',
  'Test helpers should only be used in spec mode',
);

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
export async function expectAsyncFailure(
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
export function clearRequireCache(require: Object, module: string): void {
  delete require.cache[require.resolve(module)];
}

export function uncachedRequire(require: Object, module: string): mixed {
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
export function spyOnGetterValue(object: Object, f: string): JasmineSpy {
  const value = object[f];
  delete object[f];
  object[f] = value;
  return spyOn(object, f);
}

/**
 * Checks if the two objects have equal properties. This considers a property
 * set to undefined to be equivalent to a property that was not set at all.
 */
export function arePropertiesEqual(obj1: Object, obj2: Object): boolean {
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
export async function expectObservableToStartWith<T>(
  source: Observable<T>,
  expected: Array<T>,
): Promise<void> {
  const actual: Array<T> = await source
    .take(expected.length)
    .toArray()
    .toPromise();
  expect(actual).toEqual(expected);
}

/**
 * Takes of Map of file/file-content pairs, and creates a temp dir that matches
 * the file structure of the Map. Example:
 *
 * generateFixture('myfixture', new Map([
 *   ['foo.js'],
 *   ['bar/baz.txt', 'some text'],
 * ]));
 *
 * Creates:
 *
 * /tmp/myfixture_1/foo.js (empty file)
 * /tmp/myfixture_1/bar/baz.txt (with 'some text')
 */
export async function generateFixture(
  fixtureName: string,
  files: ?Map<string, ?string>,
): Promise<string> {
  temp.track();

  const MAX_CONCURRENT_FILE_OPS = 100;
  const tempDir = await fsPromise.tempdir(fixtureName);

  if (files == null) {
    return tempDir;
  }

  // Map -> Array with full paths
  const fileTuples = Array.from(files, tuple => {
    // It's our own array - it's ok to mutate it
    tuple[0] = nuclideUri.join(tempDir, tuple[0]);
    return tuple;
  });

  // Dedupe the dirs that we have to make.
  const dirsToMake = fileTuples
    .map(([filename]) => nuclideUri.dirname(filename))
    .filter((dirname, i, arr) => arr.indexOf(dirname) === i);

  await asyncLimit(dirsToMake, MAX_CONCURRENT_FILE_OPS, dirname =>
    fsPromise.mkdirp(dirname),
  );

  await asyncLimit(
    fileTuples,
    MAX_CONCURRENT_FILE_OPS,
    ([filename, contents]) => {
      // We can't use fsPromise/fs-plus because it does too much extra work.
      // They call `mkdirp` before `writeFile`. We know that the target dir
      // exists, so we can optimize by going straight to `fs`. When you're
      // making 10k files, this adds ~500ms.
      return new Promise((resolve, reject) => {
        fs.writeFile(filename, contents || '', err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    },
  );

  return tempDir;
}

export function writeCoverage(): void {
  const {COVERAGE_DIR} = process.env;
  if (COVERAGE_DIR != null) {
    const coverage = global.__coverage__;
    if (coverage != null) {
      fs.writeFileSync(
        nuclideUri.join(COVERAGE_DIR, uuid.v4() + '.json'),
        JSON.stringify(coverage),
      );
    }
  }
}
