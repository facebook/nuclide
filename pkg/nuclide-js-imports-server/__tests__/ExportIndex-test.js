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
import {ExportIndex} from '../src/lib/ExportIndex';

describe('ExportIndex', () => {
  it('should filter by prefix', () => {
    const exportIndex = new ExportIndex();
    exportIndex.setAll('someFile.js', [
      {
        id: 'SomeExport',
        isDefault: false,
        isTypeExport: false,
        uri: 'someFile.js',
        line: 1,
      },
      {
        id: 'SomeExport2',
        isDefault: false,
        isTypeExport: false,
        uri: 'someFile.js',
        line: 1,
      },
      {
        id: 'AnotherExport',
        isDefault: false,
        isTypeExport: false,
        uri: 'someFile.js',
        line: 1,
      },
    ]);
    const ids = exportIndex.getIdsMatching('Some', 10);
    expect(ids.length).toBe(2);
    expect(ids.find(e => e === 'SomeExport')).toBeDefined();
    expect(ids.find(e => e === 'SomeExport2')).toBeDefined();
  });
  it('should filter by prefix after files have been cleared', () => {
    const exportIndex = new ExportIndex();
    exportIndex.setAll('someFile.js', [
      {
        id: 'AutoImportsManager',
        isDefault: false,
        isTypeExport: false,
        uri: 'someFile.js',
        line: 1,
      },
      {
        id: 'AutoImportsManager-spec.js',
        isDefault: false,
        isTypeExport: false,
        uri: 'someFile.js',
        line: 1,
      },
      {
        id: 'AutoImportsWorker',
        isDefault: false,
        isTypeExport: false,
        uri: 'someFile.js',
        line: 1,
      },
      {
        id: 'AutoImports',
        isDefault: false,
        isTypeExport: false,
        uri: 'someFile.js',
        line: 1,
      },
    ]);
    exportIndex.clearExportsFromFile('someFile.js');
    exportIndex.setAll('someFile.js', [
      {
        id: 'AutoImportsWorker',
        isDefault: false,
        isTypeExport: false,
        uri: 'someFile.js',
        line: 1,
      },
      {
        id: 'SomethingElse',
        isDefault: false,
        isTypeExport: false,
        uri: 'someFile.js',
        line: 1,
      },
    ]);
    const ids = exportIndex.getIdsMatching('Auto', 100);
    expect(ids.length).toBe(1);
    const ids2 = exportIndex.getIdsMatching('SomethingElse', 100);
    expect(ids2.length).toBe(1);
    const ids3 = exportIndex.getIdsMatching('AutoImportsW', 100);
    expect(ids3.length).toBe(1);
  });
  it('should fuzzy match', () => {
    const exportIndex = new ExportIndex();
    exportIndex.setAll('someFile.js', [
      {
        id: 'SomeClass',
        isDefault: false,
        isTypeExport: false,
        uri: 'someFile.js',
        line: 1,
      },
    ]);
    exportIndex.setAll('anotherFile.js', [
      {
        id: 'SomeOtherClass',
        isDefault: false,
        isTypeExport: false,
        uri: 'anotherFile.js',
        line: 1,
      },
    ]);
    exportIndex.clearExportsFromFile('someFile.js');
    const ids = exportIndex.getIdsMatching('SeOther', 100);
    expect(ids.length).toBe(1);
  });
});
