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

import typeof * as TestModuleType from './fixtures/toBeTested';

import fs from 'fs';
import glob from 'glob';
import nuclideUri from '../nuclideUri';
import {
  arePropertiesEqual,
  clearRequireCache,
  expectAsyncFailure,
  generateFixture,
  uncachedRequire,
} from '../test-helpers';

describe('arePropertiesEqual', () => {
  it('correctly compares empty objects', () => {
    expect(arePropertiesEqual({}, {})).toBe(true);
  });

  it('correctly compares objects with the same properties', () => {
    expect(arePropertiesEqual({foo: 5}, {foo: 5})).toBe(true);
  });

  it('allows one property to be undefined while another does not exist at all', () => {
    expect(arePropertiesEqual({foo: undefined}, {})).toBe(true);
  });

  it('returns false when properties are not equal', () => {
    expect(arePropertiesEqual({foo: 5}, {foo: 4})).toBe(false);
  });

  it('returns false when one property is undefined and another is defined', () => {
    expect(arePropertiesEqual({foo: 5}, {foo: undefined})).toBe(false);
    expect(arePropertiesEqual({foo: undefined}, {foo: 5})).toBe(false);
  });

  it('returns false when one property exists but the other does not', () => {
    expect(arePropertiesEqual({foo: 5}, {})).toBe(false);
    expect(arePropertiesEqual({}, {foo: 5})).toBe(false);
  });
});

describe('expectAsyncFailure', () => {
  it('fails when provided Promise succeeds', () => {
    const verify: any = jasmine.createSpy();
    waitsForPromise({shouldReject: true}, () => {
      return expectAsyncFailure(
        Promise.resolve('resolved, not rejected!'),
        verify,
      );
    });
    runs(() => {
      expect(verify.callCount).toBe(0);
    });
  });

  it('fails when provided Promise fails but with wrong error message', () => {
    let callCount = 0;
    function verify(error) {
      ++callCount;
      const expectedMessage = 'I failed badly.';
      if (error.message !== expectedMessage) {
        throw Error(`Expected '${expectedMessage}', but was ${error.message}.`);
      }
    }

    waitsForPromise({shouldReject: true}, () => {
      return expectAsyncFailure(Promise.reject(Error('I failed.')), verify);
    });
    runs(() => {
      expect(callCount).toBe(1);
    });
  });

  it('succeeds when provided Promise fails in the expected way', () => {
    let callCount = 0;
    function verify(error) {
      ++callCount;
      const expectedMessage = 'I failed badly.';
      if (error.message !== expectedMessage) {
        throw Error(`Expected '${expectedMessage}', but was ${error.message}.`);
      }
    }

    waitsForPromise({shouldReject: false}, () => {
      return expectAsyncFailure(
        Promise.reject(Error('I failed badly.')),
        verify,
      );
    });
    runs(() => {
      expect(callCount).toBe(1);
    });
  });
});

describe('generateFixture', () => {
  it('should create the directory hierarchy', () => {
    waitsForPromise(async () => {
      const fixturePath = await generateFixture(
        'fixture-to-generate',
        new Map([['foo.js', undefined], ['bar/baz.txt', 'some text']]),
      );

      expect(nuclideUri.isAbsolute(fixturePath)).toBe(true);
      expect(fs.statSync(fixturePath).isDirectory()).toBe(true);

      const fooPath = nuclideUri.join(fixturePath, 'foo.js');
      const bazPath = nuclideUri.join(fixturePath, 'bar/baz.txt');

      expect(fs.statSync(fooPath).isFile()).toBe(true);
      expect(fs.statSync(bazPath).isFile()).toBe(true);

      expect(fs.readFileSync(fooPath, 'utf8')).toBe('');
      expect(fs.readFileSync(bazPath, 'utf8')).toBe('some text');
    });
  });

  it('should work with lots of files', () => {
    waitsForPromise({timeout: 10000}, async () => {
      const files = new Map();
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 1000; j++) {
          files.set(`dir_${i}/file_${j}.txt`, `${i} + ${j} = ${i + j}`);
        }
      }
      const fixturePath = await generateFixture('lots-of-files', files);
      const fixtureFiles = glob.sync(
        nuclideUri.join(fixturePath, 'dir_*/file_*.txt'),
      );
      expect(fixtureFiles.length).toBe(10000);
    });
  });

  it('should work with no files', () => {
    waitsForPromise(async () => {
      const fixturePath = await generateFixture('fixture-empty', new Map());
      expect(nuclideUri.isAbsolute(fixturePath)).toBe(true);
      expect(fs.statSync(fixturePath).isDirectory()).toBe(true);
      expect(fs.readdirSync(fixturePath)).toEqual([]);
    });
  });

  it('works with no files arg', () => {
    waitsForPromise(async () => {
      const fixturePath = await generateFixture('fixture-empty');
      expect(nuclideUri.isAbsolute(fixturePath)).toBe(true);
      expect(fs.statSync(fixturePath).isDirectory()).toBe(true);
      expect(fs.readdirSync(fixturePath)).toEqual([]);
    });
  });
});

describe('Mocking Imports test suite', () => {
  // Tests ToBeTested.functionToTest while mocking imported function toBeMocked.
  it('Mocking imported dependencies', () => {
    // 1 - First mock all functions imported by the module under test
    const mock = spyOn(
      require('./fixtures/toBeMocked'),
      'importedFunction',
    ).andReturn(45);

    // 2 - Do an uncachedRequire of the module to test
    // Note the 'import typeof * as ... ' above to get type checking
    // for the functions to be tested.
    // You may want to put steps 1 & 2 in your beforeEach.
    const moduleToTest: TestModuleType = (uncachedRequire(
      require,
      './fixtures/toBeTested',
    ): any);

    // 3 - Perform your test
    const result = moduleToTest.functionToTest();
    expect(mock).toHaveBeenCalledWith(42);
    expect(result).toEqual(45);

    // 4 - Reset the require cache so your mocks don't get used for other tests.
    // You may want to put this in your afterEach.
    clearRequireCache(require, './fixtures/toBeTested');
  });
});
