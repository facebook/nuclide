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

import {Range} from 'atom';

import {getPackageUrlForRange} from '../lib/NPMHyperclickProvider';

const sampleJSON = `{
  "someProperty": {
    "thing": "0.0.0"
  },
  "dependencies": {
    "npm-package": "0.0.0",
    "something-else": {
      "what-is-this": "0.0.0"
    },
    "git-url": "git://github.com/user/project.git",
    "file-path": "file:some/path",
    "http-url": "http://asdf.asdf",
    "github": "facebook/nuclide#v0.130.0",
    "github-prefix": "github:facebook/nuclide"
  }
}`;

describe('getPackageUrlForRange', () => {
  it('should provide an npm URL for a dependency', () => {
    expect(
      getPackageUrlForRange(
        sampleJSON,
        '"npm-package"',
        new Range([5, 4], [5, 17]),
      ),
    ).toEqual('https://www.npmjs.com/package/npm-package/');
  });

  it('should not provide a URL for a dependency with a non-literal property', () => {
    expect(
      getPackageUrlForRange(
        sampleJSON,
        '"something-else"',
        new Range([6, 4], [6, 20]),
      ),
    ).toBeNull();
  });

  it('should not provide a URL for a nested property in a dependency', () => {
    expect(
      getPackageUrlForRange(
        sampleJSON,
        '"what-is-this"',
        new Range([7, 6], [7, 20]),
      ),
    ).toBeNull();
  });

  it('should not provide a URL for a dependency with a non-semver version', () => {
    expect(
      getPackageUrlForRange(
        sampleJSON,
        '"git-url"',
        new Range([9, 4], [9, 13]),
      ),
    ).toBeNull();
    expect(
      getPackageUrlForRange(
        sampleJSON,
        '"file-path"',
        new Range([10, 4], [10, 15]),
      ),
    ).toBeNull();
    expect(
      getPackageUrlForRange(
        sampleJSON,
        '"http-url"',
        new Range([11, 4], [11, 14]),
      ),
    ).toBeNull();
  });

  it('should provide a URL for a github dependency', () => {
    expect(
      getPackageUrlForRange(
        sampleJSON,
        '"github"',
        new Range([12, 4], [12, 12]),
      ),
    ).toEqual('https://github.com/facebook/nuclide/tree/v0.130.0');
    expect(
      getPackageUrlForRange(
        sampleJSON,
        '"github-prefix"',
        new Range([13, 4], [13, 19]),
      ),
    ).toEqual('https://github.com/facebook/nuclide');
  });

  it('should not provide a URL for the "dependencies" string itself', () => {
    expect(
      getPackageUrlForRange(
        sampleJSON,
        '"dependencies"',
        new Range([4, 2], [4, 16]),
      ),
    ).toBeNull();
  });

  it('should not provide a URL for non-dependencies', () => {
    expect(
      getPackageUrlForRange(sampleJSON, '"thing"', new Range([2, 4], [2, 11])),
    ).toBeNull();
  });
});
