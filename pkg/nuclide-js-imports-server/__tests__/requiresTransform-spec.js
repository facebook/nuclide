/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */

import DefaultModuleMap from '../src/common/state/DefaultModuleMap';

import transform from '../src/common/transform';
import fs from 'fs';
import path from 'path';

import commonJSXNonReactNames from '../src/common/constants/commonJSXNonReactNames';

const TESTS = [
  'add-array-expressions',
  'add-assignments',
  'add-bare-function-argument-types',
  'add-classes',
  'add-common-aliases',
  'add-constructor-arguments',
  'add-default-params',
  'add-expressions',
  'add-flow-typecasts',
  'add-function-calls',
  'add-if-elses',
  'add-jsx-elements',
  'add-jsx-fragments',
  'add-loops',
  'add-object-properties',
  'add-object-spreads',
  'add-polymorphic-type-bounds',
  'add-polymorphic-types',
  'add-react-when-using-jsx',
  'add-requires-after-jest',
  'add-requires-after-use-strict',
  'add-returns',
  'add-spread-args',
  'add-switches',
  'add-tagged-template-expressions',
  'add-template-expressions',
  'add-template-identifiers',
  'add-try-catches',
  'add-types',
  'allow-only-requires',
  'demote-requires',
  'experimental-syntax',
  'group-capital-specifiers-with-lowercase',
  'group-capital-value-import-specifiers-with-lowercase',
  'group-typeof-separately',
  'ignore-arbitrary-new-lines',
  'ignore-array-pattern-elements',
  'ignore-builtin-types',
  'ignore-comments-with-no-requires',
  'ignore-declare-class',
  'ignore-declared-jsx',
  'ignore-function-params',
  'ignore-flow-utility-types',
  'ignore-multiple-comments',
  'ignore-nested-object-patterns',
  'ignore-react-when-using-jsx',
  'ignore-require-access',
  'ignore-requires-in-blocks',
  'ignore-rest-args',
  'keep-custom-react-suffix',
  'keep-header-comments',
  'keep-header-whitespace',
  'keep-preceding-block-comments',
  'keep-preceding-single-line-comments',
  'keep-trailing-comments',
  'promote-types',
  'remove-duplicate-requires',
  'remove-duplicate-inline-requires',
  'remove-duplicate-inline-value-imports',
  'remove-duplicate-specifiers',
  'remove-extra-new-lines',
  'remove-nested-object-pattern',
  'remove-react-when-using-fbt',
  'remove-shadowed-requires',
  'remove-shadowed-types',
  'remove-unused-array-patterns',
  'remove-unused-destructured-requires',
  'remove-unused-destructured-types',
  'remove-unused-requires',
  'remove-unused-types',
  'remove-unused-value-imports',
  'respect-declaration-kind',
  'sort-aliases',
  'sort-by-module-names',
  'sort-by-module-names-casing',
  'sort-import-aliasing-specifiers',
  'sort-import-specifiers',
  'sort-imports',
  'sort-inline-requires',
  'sort-inline-requires-special-character',
  'sort-require-aliasing-specifiers',
  'sort-require-specifiers',
  'sort-requires',
  'sort-strange-require-expressions',
  'sort-symbols-as-lowercase',
  'sort-value-imports',
  'split-multiple-leading-comments',
];

const SOURCE_OPTIONS = {
  alwaysAddMissingNames: new Set(),
  moduleMap: DefaultModuleMap,
  jsxSuffix: true,
  jsxNonReactNames: commonJSXNonReactNames,
};

function readFileP(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, 'utf8', (err, data) => {
      err ? reject(err) : resolve(data);
    });
  });
}

describe('requiresTransform', () => {
  TESTS.forEach(name => {
    it(`should ${name}`, async () => {
      const testPath = path.join(
        __dirname,
        '../__fixtures__/requires/' + name + '.test',
      );
      const expectedPath = path.join(
        __dirname,
        '../__fixtures__/requires/' + name + '.expected',
      );

      const test = await readFileP(testPath);
      const {output: actual} = transform(test, SOURCE_OPTIONS);
      const expected = await readFileP(expectedPath);
      expect(actual).toBe(expected);
    });
  });
});
