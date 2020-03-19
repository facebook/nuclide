/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import * as ProjectUtils from '../ProjectUtils';

describe('getLabelFromPath', () => {
  it('extracts a pretty label', () => {
    const pathsToExpectedLabels = new Map([
      ['nuclide://x.com/abc/def/my_project.project.toml', 'My Project'],
      ['nuclide://x.com/abc/def/my_project', 'My Project'],
      ['nuclide://x.com/abc/def/my_project.json', 'My Project'],
      ['nuclide://x.com/abc/def/My_iOS_Project.project.toml', 'My iOS Project'],
      ['./abc/def/my_project.project.toml', 'My Project'],
      ['./abc/def/my_project', 'My Project'],
      ['./abc/def/My_iOS_Project.project.toml', 'My iOS Project'],
      ['./abc/def/.my_project.project.toml', 'My Project'],
      ['./abc/def/.www.project.toml', 'www'],
      ['./abc/def/.hello', '.hello'],
      ['./abc/def/_hello.project.toml', 'Hello'],
      ['./abc/def/___', '___'],
    ]);

    pathsToExpectedLabels.forEach((label, path) => {
      expect(ProjectUtils.getLabelFromPath(path)).toBe(label);
    });
  });
});
