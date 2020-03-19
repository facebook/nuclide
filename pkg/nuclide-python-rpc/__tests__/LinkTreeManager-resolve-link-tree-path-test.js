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
import nuclideUri from 'nuclide-commons/nuclideUri';
import LinkTreeManager from '../lib/LinkTreeManager';
import {copyBuildFixture} from '../../nuclide-test-helpers';
import path from 'path';

jest.setTimeout(60000);

// Disable buckd so it doesn't linger around after the test.
process.env.NO_BUCKD = '1';

describe('LinkTreeManager', () => {
  let linkTreeManager: LinkTreeManager = (null: any);
  let projectDir: string = (null: any);

  beforeEach(async () => {
    global.performance.mark = jest.fn();
    global.performance.measure = jest.fn();
    global.performance.clearMarks = jest.fn();
    global.performance.clearMeasures = jest.fn();

    if (projectDir == null) {
      projectDir = await copyBuildFixture(
        'test-buck-project',
        path.resolve(__dirname, '../__mocks__'),
      );
    }
    linkTreeManager = new LinkTreeManager();
  });

  // this test is very slow because it runs buck under the hood
  it("resolves a link tree path with a buck project's source file", async () => {
    const srcPath = nuclideUri.join(projectDir, 'test1/test1.py');
    const linkTreePaths = await linkTreeManager.getLinkTreePaths(srcPath);
    expect(linkTreePaths).toEqual([
      nuclideUri.join(projectDir, 'buck-out/gen/test1/testbin1#link-tree'),
    ]);
  });
});
