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

import {ImportFormatter} from '../src/lib/ImportFormatter';

import type {JSExport} from '../src/lib/types';

describe('ImportFormatter', () => {
  it('Should properly format filenames', () => {
    const suggestedImport: JSExport = {
      id: 'SomeSymbol',
      uri: '/Users/login/home/root/someFile.js',
      isTypeExport: false,
      isDefault: false,
    };

    const formatter = new ImportFormatter([], false);
    expect(
      formatter.formatImportFile(
        '/Users/login/home/root/subdirectory/file.js',
        suggestedImport,
      ),
    ).toBe('../someFile');
  });
  it('Should properly format filesnames with modules', () => {
    const suggestedImport: JSExport = {
      id: 'SomeSymbol',
      uri: '/Users/login/home/root/subdirectory/modules/module1/someFile.js',
      isTypeExport: false,
      isDefault: false,
    };

    const formatter = new ImportFormatter(
      ['/Users/login/home/root/subdirectory/modules'],
      false,
    );
    expect(
      formatter.formatImportFile(
        '/Users/login/home/root/subdirectory/someProject/someSubdirectory/file.js',
        suggestedImport,
      ),
    ).toBe('module1/someFile');
  });

  it('Should properly format filesnames with leading period', () => {
    const suggestedImport: JSExport = {
      id: 'SomeSymbol',
      uri: '/Users/login/home/root/subdirectory/types.js',
      isTypeExport: false,
      isDefault: false,
    };

    const formatter = new ImportFormatter(
      ['/Users/login/home/root/subdirectory/modules'],
      false,
    );
    expect(
      formatter.formatImportFile(
        '/Users/login/home/root/subdirectory/file.js',
        suggestedImport,
      ),
    ).toBe('./types');
  });
  it('Should properly format import statement for values', () => {
    const suggestedImport: JSExport = {
      id: 'SomeSymbol',
      uri: '/Users/login/home/root/someFile.js',
      isTypeExport: false,
      isDefault: false,
    };

    const formatter = new ImportFormatter([], false);
    expect(
      formatter.formatImport(
        '/Users/login/home/root/subdirectory/file.js',
        suggestedImport,
      ),
    ).toBe("import {SomeSymbol} from '../someFile'");
  });
  it('Should properly format import statement for types', () => {
    const suggestedImport: JSExport = {
      id: 'SomeType',
      uri: '/Users/login/home/root/someFile.js',
      isTypeExport: true,
      isDefault: false,
    };

    const formatter = new ImportFormatter([], false);
    expect(
      formatter.formatImport(
        '/Users/login/home/root/subdirectory/file.js',
        suggestedImport,
      ),
    ).toBe("import type {SomeType} from '../someFile'");
  });
  it('Should properly format import statement for default exports', () => {
    const suggestedImport: JSExport = {
      id: 'SomeSymbol',
      uri: '/Users/login/home/root/someFile.js',
      isTypeExport: false,
      isDefault: true,
    };

    const formatter = new ImportFormatter([], false);
    expect(
      formatter.formatImport(
        '/Users/login/home/root/subdirectory/file.js',
        suggestedImport,
      ),
    ).toBe("import SomeSymbol from '../someFile'");
  });
  it('Should provide a relative import for files within the same module', () => {
    const suggestedImport: JSExport = {
      id: 'SomeSymbol',
      uri: '/Users/modules/atom-ide-ui/somePackage/someFile.js',
      isTypeExport: false,
      isDefault: true,
    };
    const formatter = new ImportFormatter(['/Users/modules'], false);
    expect(
      formatter.formatImport(
        '/Users/modules/atom-ide-ui/aDifferentPackage/lib/anotherFile.js',
        suggestedImport,
      ),
    ).toBe("import SomeSymbol from '../../somePackage/someFile'");
  });
  it('Should NOT provide a relative import for files NOT within the same module', () => {
    const suggestedImport: JSExport = {
      id: 'SomeSymbol',
      uri: '/Users/modules/atom-ide-ui/somePackage/someFile.js',
      isTypeExport: false,
      isDefault: true,
    };
    const formatter = new ImportFormatter(['/Users/modules'], false);
    expect(
      formatter.formatImport(
        '/Users/modules/nuclide-commons/aDifferentPackage/lib/anotherFile.js',
        suggestedImport,
      ),
    ).toBe("import SomeSymbol from 'atom-ide-ui/somePackage/someFile'");
  });
  it('Should correctly handle haste formatting with JS files', () => {
    const suggestedImport: JSExport = {
      id: 'SomeSymbol',
      uri: '/Users/modules/somePackage/somePackage/AutoImportsManager.js',
      isTypeExport: false,
      isDefault: true,
    };
    const formatter = new ImportFormatter([], true);
    expect(
      formatter.formatImportFile(
        '/Users/modules/somePackage/somePackage/AutoImportsManager.js',
        suggestedImport,
      ),
    ).toBe('AutoImportsManager');
  });
  it('Should correctly handle haste formatting with React files', () => {
    const suggestedImport: JSExport = {
      id: 'SomeSymbol',
      uri: '/Users/modules/somePackage/somePackage/AutoImportsManager.react.js',
      isTypeExport: false,
      isDefault: true,
    };
    const formatter = new ImportFormatter([], true);
    expect(
      formatter.formatImportFile(
        '/Users/modules/somePackage/somePackage/AutoImportsManager.react.js',
        suggestedImport,
      ),
    ).toBe('AutoImportsManager.react');
  });
});
