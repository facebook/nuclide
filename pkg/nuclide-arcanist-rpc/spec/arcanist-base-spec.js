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

import * as arcanist from '..';
import nuclideUri from 'nuclide-commons/nuclideUri';
import fsPromise from 'nuclide-commons/fsPromise';
import {copyFixture} from '../../nuclide-test-helpers';
import {Observable} from 'rxjs';

const rootConfig = {
  project_id: 'project1',
};
const nestedConfig = {
  project_id: 'project-nested',
};

describe('nuclide-arcanist-rpc', () => {
  let rootPath: string = (null: any);
  let rootParentPath: string = (null: any);
  let dirPath: string = (null: any);
  let file1Path: string = (null: any);
  let file2Path: string = (null: any);
  let nestedPath: string = (null: any);

  beforeEach(() => {
    waitsForPromise(async () => {
      rootPath = await copyFixture('arc', __dirname);
      rootParentPath = nuclideUri.dirname(rootPath);
      dirPath = nuclideUri.join(rootPath, 'dir1');
      file1Path = nuclideUri.join(dirPath, 'file1');
      file2Path = nuclideUri.join(rootPath, 'file2');
      nestedPath = nuclideUri.join(rootPath, 'nested-project');

      await Promise.all([
        fsPromise.rename(
          nuclideUri.join(rootPath, '.arcconfig.test'),
          nuclideUri.join(rootPath, '.arcconfig'),
        ),
        fsPromise.rename(
          nuclideUri.join(nestedPath, '.arcconfig.test'),
          nuclideUri.join(nestedPath, '.arcconfig'),
        ),
      ]);
    });
  });

  it('findArcConfigDirectory', () => {
    waitsForPromise(async () => {
      expect(await arcanist.findArcConfigDirectory(rootPath)).toBe(rootPath);
      expect(await arcanist.findArcConfigDirectory(dirPath)).toBe(rootPath);
      expect(await arcanist.findArcConfigDirectory(file1Path)).toBe(rootPath);
      expect(await arcanist.findArcConfigDirectory(file2Path)).toBe(rootPath);
      expect(await arcanist.findArcConfigDirectory(nestedPath)).toBe(
        nestedPath,
      );
      expect(await arcanist.findArcConfigDirectory(rootParentPath)).toBe(null);
    });
  });

  it('readArcConfig', () => {
    waitsForPromise(async () => {
      expect(await arcanist.readArcConfig(rootPath)).toEqual(rootConfig);
      expect(await arcanist.readArcConfig(dirPath)).toEqual(rootConfig);
      expect(await arcanist.readArcConfig(file1Path)).toEqual(rootConfig);
      expect(await arcanist.readArcConfig(file2Path)).toEqual(rootConfig);
      expect(await arcanist.readArcConfig(nestedPath)).toEqual(nestedConfig);
      expect(await arcanist.readArcConfig(rootParentPath)).toEqual(null);
    });
  });

  it('findArcProjectIdOfPath', () => {
    waitsForPromise(async () => {
      expect(await arcanist.findArcProjectIdOfPath(rootPath)).toBe('project1');
      expect(await arcanist.findArcProjectIdOfPath(dirPath)).toBe('project1');
      expect(await arcanist.findArcProjectIdOfPath(file1Path)).toBe('project1');
      expect(await arcanist.findArcProjectIdOfPath(file2Path)).toBe('project1');
      expect(await arcanist.findArcProjectIdOfPath(nestedPath)).toBe(
        'project-nested',
      );
      expect(await arcanist.findArcProjectIdOfPath(rootParentPath)).toBe(null);
    });
  });

  it('getProjectRelativePath', () => {
    waitsForPromise(async () => {
      expect(await arcanist.getProjectRelativePath(rootPath)).toBe('');
      expect(await arcanist.getProjectRelativePath(dirPath)).toBe('dir1');
      expect(await arcanist.getProjectRelativePath(file1Path)).toBe(
        'dir1/file1',
      );
      expect(await arcanist.getProjectRelativePath(file2Path)).toBe('file2');
      expect(await arcanist.getProjectRelativePath(nestedPath)).toBe('');
      expect(await arcanist.getProjectRelativePath(rootParentPath)).toBe(null);
    });
  });

  describe('findDiagnostics', () => {
    // Map from fake arc config dir to fake files within it.
    const filePathMap: Map<string, Array<string>> = new Map([
      ['/fake/path/one', ['path1', 'path2', '/fake/path/one/path1']],
      ['/fake/path/two', ['foo', 'bar']],
    ]);
    let arcResult: any;
    let execArgs: any;
    const fakeLint = {
      description: 'Trailing spaces not allowed. (no-trailing-spaces)',
      severity: 'warning',
      original: '  ',
      line: 78,
      bypassChangedLineFiltering: null,
      name: 'ESLint reported a warning.',
      granularity: 1,
      locations: [],
      replacement: '',
      code: 'FBNUCLIDELINT1',
      char: 2,
      context: 'this usually contains some nearby code',
    };
    const fakeLintResult = {
      type: 'Warning',
      text: 'Trailing spaces not allowed. (no-trailing-spaces)',
      filePath: '/fake/path/one/path1',
      row: 77,
      col: 1,
      code: 'FBNUCLIDELINT1',
      original: '  ',
      replacement: '',
    };

    function setResult(...results) {
      // This mimics the output that `arc lint` can provide. Sometimes it provides results as valid
      // JSON objects separated by a newline. The result is not valid JSON but it's what we get.
      arcResult = results.map(result => JSON.stringify(result));
    }

    beforeEach(() => {
      setResult({});
      execArgs = [];
      spyOn(
        require('nuclide-commons/nice'),
        'niceObserveProcess',
      ).andCallFake((command, args, options) => {
        execArgs.push(args);
        return Observable.from(
          arcResult.map(line => ({kind: 'stdout', data: line})),
        );
      });
      arcanist.__TEST__.reset();
      // Add these paths to the arcConfigDirectoryMap as a roundabout way to mock
      // findArcConfigDirectory.
      for (const [arcDir, filePaths] of filePathMap) {
        for (const filePath of filePaths) {
          arcanist.__TEST__.arcConfigDirectoryMap.set(filePath, arcDir);
        }
      }
    });

    it('should call `arc lint` with the paths', () => {
      waitsForPromise(async () => {
        const filePath = 'path1';
        await arcanist.findDiagnostics(filePath, []).refCount().toPromise();
        // Expect arc lint to be called once
        expect(execArgs.length).toBe(1);
        expect(execArgs[0].indexOf(filePath)).toBeGreaterThan(-1);
      });
    });

    it('should return the lints', () => {
      waitsForPromise(async () => {
        setResult({
          path1: [fakeLint],
        });
        const lints = await arcanist
          .findDiagnostics('/fake/path/one/path1', [])
          .refCount()
          .toArray()
          .toPromise();
        expect(lints).toEqual([fakeLintResult]);
      });
    });

    it('should return the lints even when they are in separate JSON objects', () => {
      waitsForPromise(async () => {
        const fakeArcResult = {path1: [fakeLint]};
        setResult(fakeArcResult, fakeArcResult);
        const lints = await arcanist
          .findDiagnostics('/fake/path/one/path1', [])
          .refCount()
          .toArray()
          .toPromise();
        expect(lints).toEqual([fakeLintResult, fakeLintResult]);
      });
    });
  });
});
