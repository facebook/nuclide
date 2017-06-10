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

import {createAdapters, validateLinter} from '../lib/LinterAdapterFactory';

const grammar = 'testgrammar';

describe('createAdapters', () => {
  function createAdaptersWithMock(linterProviders) {
    return createAdapters(linterProviders);
  }

  let fakeLinter: any;

  beforeEach(() => {
    const fakeEditor = {
      getPath() {
        return 'foo';
      },
      getGrammar() {
        return {scopeName: grammar};
      },
    };
    spyOn(atom.workspace, 'getActiveTextEditor').andReturn(fakeEditor);
    fakeLinter = {
      name: 'test',
      grammarScopes: [grammar],
      scope: 'file',
      lintOnFly: true,
      lint: () => Promise.resolve([]),
    };
  });

  afterEach(() => {
    jasmine.unspy(atom.workspace, 'getActiveTextEditor');
  });

  it('should return a linter adapter', () => {
    expect(createAdaptersWithMock(fakeLinter).size).toBe(1);
  });

  it('should return multiple adapters if it is passed an array', () => {
    expect(createAdaptersWithMock([fakeLinter, fakeLinter]).size).toBe(2);
  });
});

describe('validateLinter', () => {
  let linter: any;

  beforeEach(() => {
    linter = {
      name: 'test',
      grammarScopes: [grammar],
      scope: 'file',
      lintOnFly: true,
      lint: () => Promise.resolve([]),
    };
  });

  it('should not return errors for a valid linter', () => {
    expect(validateLinter(linter).length).toEqual(0);
  });

  it('should return errors for a linter with no lint function', () => {
    linter.lint = undefined;
    expect(validateLinter(linter)).toEqual([
      'lint function must be specified',
      'lint must be a function',
    ]);
  });

  it('should return errors for a linter where lint is not a function', () => {
    linter.lint = [];
    expect(validateLinter(linter)).toEqual(['lint must be a function']);
  });
});
