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
 * @emails oncall+nuclide
 */
import typeof * as TestModuleType from '../__mocks__/fixtures/toBeTested';

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
  it('fails when provided Promise succeeds', async () => {
    const verify: any = jest.fn();
    await expect(
      expectAsyncFailure(Promise.resolve('resolved, not rejected!'), verify),
    ).rejects.toThrow(/but did not/);
    expect(verify.mock.calls).toHaveLength(0);
  });

  it('fails when provided Promise fails but with wrong error message', async () => {
    let callCount = 0;
    function verify(error) {
      ++callCount;
      const expectedMessage = 'I failed badly.';
      if (error.message !== expectedMessage) {
        throw new Error(
          `Expected '${expectedMessage}', but was ${error.message}.`,
        );
      }
    }

    await expect(
      expectAsyncFailure(Promise.reject(Error('I failed.')), verify),
    ).rejects.toThrow(/I failed/);
    expect(callCount).toBe(1);
  });

  it('succeeds when provided Promise fails in the expected way', async () => {
    let callCount = 0;
    function verify(error) {
      ++callCount;
      const expectedMessage = 'I failed badly.';
      if (error.message !== expectedMessage) {
        throw new Error(
          `Expected '${expectedMessage}', but was ${error.message}.`,
        );
      }
    }

    await expectAsyncFailure(Promise.reject(Error('I failed badly.')), verify);
    expect(callCount).toBe(1);
  });
});

describe('generateFixture', () => {
  it('should create the directory hierarchy', async () => {
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

  it(
    'should work with lots of files',
    async () => {
      const files = new Map();
      for (let i = 0; i < 10; i++) {
        for (let j = 0; j < 300; j++) {
          files.set(`dir_${i}/file_${j}.txt`, `${i} + ${j} = ${i + j}`);
        }
      }
      const fixturePath = await generateFixture('lots-of-files', files);
      const fixtureFiles = glob.sync(
        nuclideUri.join(fixturePath, 'dir_*/file_*.txt'),
      );
      expect(fixtureFiles.length).toBe(3000);
    },
    20000,
  );

  it('should work with no files', async () => {
    const fixturePath = await generateFixture('fixture-empty', new Map());
    expect(nuclideUri.isAbsolute(fixturePath)).toBe(true);
    expect(fs.statSync(fixturePath).isDirectory()).toBe(true);
    expect(fs.readdirSync(fixturePath)).toEqual([]);
  });

  it('works with no files arg', async () => {
    const fixturePath = await generateFixture('fixture-empty');
    expect(nuclideUri.isAbsolute(fixturePath)).toBe(true);
    expect(fs.statSync(fixturePath).isDirectory()).toBe(true);
    expect(fs.readdirSync(fixturePath)).toEqual([]);
  });
});

describe('Mocking Imports test suite', () => {
  // Tests ToBeTested.functionToTest while mocking imported function toBeMocked.
  it('Mocking imported dependencies', () => {
    // 1 - First mock all functions imported by the module under test
    const mock = jest
      .spyOn(require('../__mocks__/fixtures/toBeMocked'), 'importedFunction')
      .mockReturnValue(45);

    // 2 - Do an uncachedRequire of the module to test
    // Note the 'import typeof * as ... ' above to get type checking
    // for the functions to be tested.
    // You may want to put steps 1 & 2 in your beforeEach.
    const moduleToTest: TestModuleType = (uncachedRequire(
      require,
      '../__mocks__/fixtures/toBeTested',
    ): any);

    // 3 - Perform your test
    const result = moduleToTest.functionToTest();
    expect(mock).toHaveBeenCalledWith(42);
    expect(result).toEqual(45);

    // 4 - Reset the require cache so your mocks don't get used for other tests.
    // You may want to put this in your afterEach.
    clearRequireCache(require, '../__mocks__/fixtures/toBeTested');
  });
});
