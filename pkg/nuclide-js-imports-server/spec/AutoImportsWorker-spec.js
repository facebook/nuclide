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

import {generateFixture} from 'nuclide-commons/test-helpers';
import {indexDirectory, indexNodeModules} from '../src/lib/AutoImportsWorker';
import nuclideUri from 'nuclide-commons/nuclideUri';

const hasteSettings = {
  isHaste: false,
  useNameReducers: false,
  nameReducers: [],
  nameReducerWhitelist: [],
  nameReducerBlacklist: [],
};

describe('AutoImportsWorker', () => {
  it('Should index imports in a directory asynchronously', () => {
    const exports = [];
    indexDirectory(
      nuclideUri.join(__dirname, 'fixtures'),
      hasteSettings,
    ).subscribe(exportsForFiles => {
      exportsForFiles.forEach(exportsForFile => {
        exportsForFile.exports.forEach(exp => {
          exports.push(exp);
        });
      });
    });
    waitsFor(() => {
      return exports.find(exp => exp.id === 'MyFakeClassForTesting');
    });

    waitsFor(() => {
      return exports.find(exp => exp.id === 'MyFakeTypeForTesting');
    });
  });

  it('Should index all files in a directory', () => {
    const exports = [];
    indexDirectory(
      nuclideUri.join(__dirname, 'fixtures'),
      hasteSettings,
    ).subscribe(exportsForFiles => {
      exportsForFiles.forEach(exportsForFile => {
        exportsForFile.exports.forEach(exp => {
          exports.push(exp);
        });
      });
    });
    waitsFor(() => {
      return exports.find(exp => exp.id === 'MyFakeClassForTesting');
    });

    waitsFor(() => {
      return exports.find(exp => exp.id === 'FooBarClass');
    });
  });
});

describe('AutoImportsWorker main files indexer', () => {
  // Create fixtures for these tests.
  let dirPath: string = (null: any);
  beforeEach(() => {
    waitsForPromise(async () => {
      dirPath = await generateFixture(
        'main_tests',
        new Map([
          ['some_package/package.json', '{"main": "./lib/main.js"}'],
          ['some_package/lib/main.js', 'export class SomeTestClass {}'],
          ['some_package/lib/someOtherFile.js', 'export class Something {}'],
          ['another_package/package.json', 'this isnt valid json'],
          [
            'complicated_package/modules/lib/tools/package.json',
            '{"main": "../../main.js"}',
          ],
          [
            'complicated_package/modules/main.js',
            'export type SomeType = string',
          ],
          [
            'package_with_main_without_extension/package.json',
            '{"main": "./main"}',
          ],
          [
            'package_with_main_without_extension/main.js',
            'export class AnotherClass {}',
          ],
          ['package_json_without_main/package.json', '{"name": "package"}'],
          ['package_json_without_main/index.js', 'export class Test{}'],
        ]),
      );
    });
  });

  it('Should correctly mark files as main', () => {
    let found = false;
    indexDirectory(dirPath, hasteSettings).subscribe(exportsForFiles => {
      if (
        exportsForFiles.find(
          exportsForFile =>
            exportsForFile.exports.find(e => e.directoryForMainFile != null) &&
            exportsForFile.file ===
              nuclideUri.join(dirPath, 'some_package/lib/main.js'),
        )
      ) {
        found = true;
      }
    });
    waitsFor(() => {
      return found;
    });
  });
  it('Should index non-main files correctly', () => {
    let found = false;
    indexDirectory(dirPath, hasteSettings).subscribe(exportsForFiles => {
      if (
        exportsForFiles.find(exportsForFile =>
          exportsForFile.exports.find(exp => exp.directoryForMainFile == null),
        ) &&
        exportsForFiles.find(
          exportsForFile =>
            exportsForFile.file ===
            nuclideUri.join(dirPath, 'some_package/lib/someOtherFile.js'),
        )
      ) {
        found = true;
      }
    });
    waitsFor(() => {
      return found;
    });
  });
  it('Should work with complicated file paths', () => {
    let found = false;
    indexDirectory(dirPath, hasteSettings).subscribe(exportsForFiles => {
      if (
        exportsForFiles.find(exportsForFile =>
          exportsForFile.exports.find(exp => exp.directoryForMainFile == null),
        ) &&
        exportsForFiles.find(
          exportsForFile =>
            exportsForFile.file ===
            nuclideUri.join(dirPath, 'some_package/lib/someOtherFile.js'),
        )
      ) {
        found = true;
      }
    });
    waitsFor(() => {
      return found;
    });
  });
  it('Should work with main files without an extension', () => {
    let found = false;
    indexDirectory(dirPath, hasteSettings).subscribe(exportsForFiles => {
      if (
        exportsForFiles.find(
          exportsForFile =>
            exportsForFile.exports.find(e => e.directoryForMainFile != null) &&
            exportsForFile.file ===
              nuclideUri.join(
                dirPath,
                'package_with_main_without_extension/main.js',
              ),
        )
      ) {
        found = true;
      }
    });
    waitsFor(() => {
      return found;
    });
  });
  it('Should assume main is index.js by default', () => {
    let found = false;
    indexDirectory(dirPath, hasteSettings).subscribe(exportsForFiles => {
      if (
        exportsForFiles.find(
          exportsForFile =>
            exportsForFile.exports.find(
              e =>
                e.directoryForMainFile ===
                nuclideUri.join(dirPath, 'package_json_without_main'),
            ) &&
            exportsForFile.file ===
              nuclideUri.join(dirPath, 'package_json_without_main/index.js'),
        )
      ) {
        found = true;
      }
    });
    waitsFor(() => {
      return found;
    });
  });
});

describe('AutoImportsWorker node_modules indexer', () => {
  let dirPath: string = (null: any);
  beforeEach(() => {
    waitsForPromise(async () => {
      dirPath = await generateFixture(
        'main_tests',
        new Map([
          ['node_modules/log4js/package.json', '{"main": "./lib/log4js.js"}'],
          [
            'node_modules/log4js/lib/log4js.js',
            'module.exports = {getLogger: () => {}}',
          ],
          ['node_modules/left-pad/package.json', '{"main": "./lib"}'],
          ['node_modules/left-pad/lib/index.js', 'module.exports = {};'],
        ]),
      );
    });
  });

  it('Should index node_modules correctly', () => {
    waitsForPromise(async () => {
      const files = await indexNodeModules(dirPath)
        .map(data => data && data.file)
        .toArray()
        .toPromise();
      files.sort();
      expect(files).toEqual([
        require.resolve(
          nuclideUri.join(dirPath, 'node_modules/left-pad/lib/index.js'),
        ),
        require.resolve(
          nuclideUri.join(dirPath, 'node_modules/log4js/lib/log4js.js'),
        ),
      ]);
    });
  });
});
