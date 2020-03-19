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
import * as BuckService from '../../nuclide-buck-rpc';
import LinkTreeManager from '../lib/LinkTreeManager';
import {copyBuildFixture} from '../../nuclide-test-helpers';
import path from 'path';

jest.setTimeout(35000);

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

  it('correctly builds a link tree path given a source file path (mocked project)', async () => {
    jest
      .spyOn(BuckService, 'getOwners')
      .mockReturnValue(Promise.resolve(['//test:a', '//test2:a']));
    const spy = jest.spyOn(BuckService, 'queryWithAttributes').mockReturnValue({
      '//test:x': {
        'buck.type': 'python_binary',
      },
      '//test:y': {
        'buck.type': 'python_test',
      },
    });
    const srcPath = nuclideUri.join(projectDir, 'test1/test1.py');
    const expectedPaths = [
      nuclideUri.join(projectDir, 'buck-out/gen/test/x#link-tree'),
      nuclideUri.join(projectDir, 'buck-out/gen/test/y#binary,link-tree'),
    ];

    const linkTreePaths = await linkTreeManager.getLinkTreePaths(srcPath);
    // rdeps query should be executed with the first owner found, and scoped to
    // the target's immediate neighbors.
    expect(spy).toHaveBeenCalledWith(
      projectDir,
      'kind("python_binary|python_test", rdeps(//test/..., //test:a))',
      ['buck.type', 'deps'],
    );
    // Properly resolve a link-tree path based on the source's firstly found
    // binary dependency.
    expect(linkTreePaths).toEqual(expectedPaths);
  });

  it('ignores TARGETS files', async () => {
    jest.spyOn(BuckService, 'getOwners').mockImplementation(() => {
      throw new Error('test');
    });
    const srcPath = nuclideUri.join(projectDir, 'test1/TARGETS');
    expect(await linkTreeManager.getLinkTreePaths(srcPath)).toEqual([]);
  });
});
