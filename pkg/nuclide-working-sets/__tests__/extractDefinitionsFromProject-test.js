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

import extractDefinitionsFromProject from '../lib/extractDefinitionsFromProject';

test('it throws out garbage', () => {
  expect(extractDefinitionsFromProject(null)).toEqual([]);

  const spec1 = {
    originPath: 'nuclide://fb.com/a/b/c.project.toml',
    paths: [],
    workingSets: [{name: 'Junk', paths: 'yes please'}],
  };
  expect(extractDefinitionsFromProject(spec1)).toEqual([]);
});

test('it resolves paths', () => {
  const spec = {
    originPath: 'nuclide://fb.com/a/b/c.project.toml',
    paths: [],
    workingSets: [
      {name: 'One', paths: ['x/one'], initiallyActive: true},
      {name: 'Two', paths: ['/x/two']},
    ],
  };
  expect(extractDefinitionsFromProject(spec)).toEqual([
    {name: 'One', uris: ['/a/b/x/one'], active: true, sourceType: 'project'},
    {name: 'Two', uris: ['/x/two'], active: false, sourceType: 'project'},
  ]);
});
