/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';

import nuclideUri from 'nuclide-commons/nuclideUri';
import type {ExportUpdateForFile} from '../src/lib/AutoImportsWorker';
// eslint-disable-next-line
const {getExportsForFile} = require('../src/lib/AutoImportsWorker');

describe('getExportsForFile component definitions', () => {
  beforeEach(() => {
    process.env.JS_IMPORTS_INITIALIZATION_SETTINGS = JSON.stringify({
      componentModulePathFilter: null,
    });
  });

  it('gets the component definition for a React component', async () => {
    const path = nuclideUri.join(
      __dirname,
      '..',
      '__mocks__',
      'componentDefinitions',
      'FDSTest.react.js',
    );
    const exportUpdate: ?ExportUpdateForFile = await getExportsForFile(path, {
      isHaste: false,
      useNameReducers: false,
      nameReducers: [],
      nameReducerWhitelist: [],
      nameReducerBlacklist: [],
    });
    expect(exportUpdate).toBeTruthy();
    invariant(exportUpdate != null);
    expect(exportUpdate.componentDefinition).toBeTruthy();
    invariant(exportUpdate.componentDefinition);
    expect(exportUpdate.componentDefinition.name).toBe('FDSTest');
    invariant(exportUpdate.componentDefinition);
    expect(
      exportUpdate.componentDefinition.requiredProps.length,
    ).toBeGreaterThan(0);
  });
});
