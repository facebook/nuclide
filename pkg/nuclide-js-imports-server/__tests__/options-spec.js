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
import jscs from 'jscodeshift';
import printRoot from '../src/common/utils/printRoot';
import requiresTransform from '../src/common/requires/transform';
import fs from 'fs';
import path from 'path';

import commonJSXNonReactNames from '../src/common/constants/commonJSXNonReactNames';

function readFileP(filename: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readFile(filename, 'utf8', (err, data) => {
      err ? reject(err) : resolve(data);
    });
  });
}

describe('options', () => {
  it('should respect blacklist options', async () => {
    const testPath = path.join(
      __dirname,
      '../__fixtures__/options/respect-blacklist.test',
    );
    const expectedPath = path.join(
      __dirname,
      '../__fixtures__/options/respect-blacklist.expected',
    );
    const test = await readFileP(testPath);

    const root = jscs(test);
    requiresTransform(root, {
      alwaysAddMissingNames: new Set(),
      moduleMap: DefaultModuleMap,
      blacklist: new Set(['requires.removeUnusedRequires']),
      jsxNonReactNames: commonJSXNonReactNames,
    });
    const actual = printRoot(root);

    const expected = await readFileP(expectedPath);
    expect(actual).toBe(expected);
  });
});
