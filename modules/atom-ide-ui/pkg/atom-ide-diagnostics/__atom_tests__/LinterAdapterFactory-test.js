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
import {
  createAdapter,
  validateLinter,
} from '../lib/services/LinterAdapterFactory';

const grammar = 'testgrammar';

describe('createAdapter', () => {
  function createAdapterWithMock(linterProviders) {
    return createAdapter(linterProviders, jest.fn());
  }

  let fakeLinter: any;

  beforeEach(() => {
    jest.restoreAllMocks();
    const fakeEditor = {
      getPath() {
        return 'foo';
      },
      getGrammar() {
        return {scopeName: grammar};
      },
    };
    jest
      .spyOn(atom.workspace, 'getActiveTextEditor')
      .mockReturnValue(fakeEditor);
    fakeLinter = {
      name: 'test',
      grammarScopes: [grammar],
      scope: 'file',
      lintOnFly: true,
      lint: () => Promise.resolve([]),
    };
  });

  it('should return a linter adapter', () => {
    expect(createAdapterWithMock(fakeLinter)).not.toBe(null);
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

  it('it should use a default name if not provided', () => {
    linter.name = null;
    expect(validateLinter(linter).length).toBe(0);
    expect(linter.name).toBe('Linter');
  });
});
