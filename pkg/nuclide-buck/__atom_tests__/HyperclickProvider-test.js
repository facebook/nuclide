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

import {
  findTargetLocation,
  parseTarget,
  resolveLoadTargetPath,
} from '../lib/HyperclickProvider';

describe('HyperclickProvider', () => {
  let projectPath: string = (null: any);

  beforeEach(() => {
    projectPath =
      nuclideUri.join(__dirname, '../__mocks__/fixtures/test-project') + '/';
    atom.project.setPaths([projectPath]);
  });

  describe('parseTarget', () => {
    it('searches //Apps/TestApp/BUCK-rename', async () => {
      let target = await parseTarget(
        ([':target1', null, 'target1']: Array<?string>),
        null,
        projectPath,
      );
      expect(target).toBe(null);

      target = await parseTarget(
        ([':target1', null, 'target1']: Array<?string>),
        projectPath + 'test/BUCK',
        projectPath,
      );
      expect(target).toEqual({
        path: projectPath + 'test/BUCK',
        name: 'target1',
      });

      target = await parseTarget(
        (['//Apps/TestApp:w3ird', '//Apps/TestApp', 'w3ird']: Array<string>),
        null,
        projectPath,
      );
      expect(target).toEqual(null);

      target = await parseTarget(
        (['//Apps/TestApp:w3ird', '//Apps/TestApp', 'w3ird']: Array<string>),
        '//test/BUCK',
        projectPath,
      );
      expect(target).toEqual({
        path: projectPath + 'Apps/TestApp/BUCK',
        name: 'w3ird',
      });
    });
  });

  describe('parseLoadTarget', () => {
    it('resolves a path for //pkg/subpkg:ext.bzl', async () => {
      const target = await resolveLoadTargetPath(
        (['//pkg/subpkg:ext.bzl', '', '//pkg/subpkg', 'ext.bzl']: Array<
          string,
        >),
        projectPath,
      );
      expect(target).toEqual(projectPath + 'pkg/subpkg/ext.bzl');
    });
  });

  describe('findTargetLocation', () => {
    const targetsByFile = {
      'Apps/TestApp/BUCK-rename': {
        Target1: 1,
        'w3ird_target-name': 7,
        Target2: 13,
        TestsTarget: 27,
        'non-existing-target': -1,
      },
      'Apps/BUCK-rename': {
        test_target123: 1,
      },
      'Libraries/TestLib1/BUCK-rename': {
        target_with_no_trailling_comma: 1,
        target_with_no_trailling_commas: -1,
        lib_target1: 5,
        'lib_target-test': 12,
        lib_target: -1,
        TestsTarget: 23,
        PUBLIC: -1,
        '[]': -1,
      },
      'Libraries/TestLib1/test-ios-sdk/sdk-v.1.2.3/BUCK-rename': {
        'target-v.1': 1,
        target: 7,
        targett: -1,
        arget: -1,
      },
    };

    for (const file in targetsByFile) {
      for (const targetName in targetsByFile[file]) {
        it('asks for a location of the target', async () => {
          await (() => {
            return findTargetLocation({
              path: projectPath + file,
              name: targetName,
            }).then(location => {
              const line = targetsByFile[file][targetName];
              if (line !== -1) {
                expect(location).toEqual({
                  path: projectPath + file,
                  line,
                  column: 0,
                });
              } else {
                expect(location).toEqual({
                  path: projectPath + file,
                  line: 0,
                  column: 0,
                });
              }
            });
          })();
        });
      }
    }
  });
});
