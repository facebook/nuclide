/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import invariant from 'assert';
import fs from 'fs';
import temp from 'temp';
import nuclideUri from '../nuclideUri';
import fsPromise from '../fsPromise';
import {generateFixture} from '../test-helpers';

temp.track();

describe('fsPromise test suite', () => {
  describe('findNearestFile()', () => {
    let dirPath: string = (null: any);

    beforeEach(async () => {
      dirPath = await generateFixture(
        'nearest_test',
        new Map([
          ['.some_file', 'just some file'],
          ['nested_dir/.another_file', 'just another file'],
        ]),
      );
    });

    it('find the file if given the exact directory', async () => {
      const foundPath = await fsPromise.findNearestFile('.some_file', dirPath);
      expect(foundPath).toBe(dirPath);
    });

    it('find the file if given a nested directory', async () => {
      const foundPath = await fsPromise.findNearestFile(
        '.some_file',
        nuclideUri.join(dirPath, 'nested_dir'),
      );
      expect(foundPath).toBe(dirPath);
    });

    it('does not find the file if not existing', async () => {
      const foundPath = await fsPromise.findNearestFile(
        'non-existent.txt',
        nuclideUri.join(dirPath, 'nested_dir'),
      );
      expect(foundPath).toBe(null);
    });
  });
  describe('mv', () => {
    let dirPath;
    beforeEach(async () => {
      dirPath = await generateFixture(
        'move',
        new Map([['foo/bar', 'bar content'], ['baz/biz', 'bar content']]),
      );
    });
    test('Dest dir exists and clobber is false', async () => {
      const source = nuclideUri.join(dirPath, 'foo');
      const dest = nuclideUri.join(dirPath, 'baz');

      await expect(
        fsPromise.mv(source, dest, {mkdirp: true, clobber: false}),
      ).rejects.toMatchObject({
        message: 'Destination file exists',
        path: dest,
        code: 'EEXIST',
      });
    });
    test('Dest dir exists and clobber is true', async () => {
      const source = nuclideUri.join(dirPath, 'foo');
      const dest = nuclideUri.join(dirPath, 'baz');

      expect(
        fsPromise.mv(source, dest, {mkdirp: true, clobber: true}),
      ).rejects.toMatchObject({
        message: expect.stringMatching(/directory not empty/),
      });
    });

    test('Dest dir is the same as source and clobber is true', async () => {
      const source = nuclideUri.join(dirPath, 'foo');
      const dest = nuclideUri.join(dirPath, 'foo');

      await fsPromise.mv(source, dest, {mkdirp: true, clobber: true});
      expect(fs.existsSync(nuclideUri.join(dirPath, 'foo/bar'))).toBe(true);
    });
    test('Dest dir is the same as source and clobber is false', async () => {
      const source = nuclideUri.join(dirPath, 'foo');
      const dest = nuclideUri.join(dirPath, 'foo');

      await expect(
        fsPromise.mv(source, dest, {mkdirp: true, clobber: false}),
      ).rejects.toMatchObject({
        message: 'Destination file exists',
        path: dest,
        code: 'EEXIST',
      });
    });

    if (process.platform === 'darwin' || process.platform === 'win32') {
      test('Dest dir is case insenstively the same as source and clobber is true', async () => {
        const source = nuclideUri.join(dirPath, 'foo');
        const dest = nuclideUri.join(dirPath, 'Foo');

        await fsPromise.mv(source, dest, {mkdirp: true, clobber: true});
        expect(fs.existsSync(nuclideUri.join(dirPath, 'foo/bar'))).toBe(true);
        expect(fs.existsSync(nuclideUri.join(dirPath, 'Foo/bar'))).toBe(true);
      });
      test('Dest dir is case insenstively the same as source and clobber is false', async () => {
        const source = nuclideUri.join(dirPath, 'foo');
        const dest = nuclideUri.join(dirPath, 'Foo');

        await expect(
          fsPromise.mv(source, dest, {mkdirp: true, clobber: false}),
        ).rejects.toMatchObject({
          message: 'Destination file exists',
          path: dest,
          code: 'EEXIST',
        });
      });
    }
  });

  describe('findFurthestFile()', () => {
    let dirPath: string = (null: any);

    beforeEach(async () => {
      dirPath = await generateFixture(
        'furthest_test',
        new Map([
          ['0/.some_file', 'just a file'],
          ['0/1/.some_file', 'just b file'],
          // Skip one file to test consecutive vs non-consecutive.
          // ['0/1/2', 'just c file'],
          ['0/1/2/3/.some_file', 'just d file'],
          ['0/1/2/3/4/.some_file', 'just f file'],
        ]),
      );
    });

    it('find the file if given the exact directory', async () => {
      const expectedPath = nuclideUri.join(dirPath, '0');
      const foundPath = await fsPromise.findFurthestFile(
        '.some_file',
        expectedPath,
      );
      expect(foundPath).toBe(expectedPath);
    });

    it('finds the furthest file if given a nested directory', async () => {
      const expectedPath = nuclideUri.join(dirPath, '0');
      const startPath = nuclideUri.join(dirPath, '0/1/2/3/4');
      const foundPath = await fsPromise.findFurthestFile(
        '.some_file',
        startPath,
      );
      expect(foundPath).toBe(expectedPath);
    });

    it('terminates search as soon as file is not found if given the stopOnMissing flag', async () => {
      const expectedPath = nuclideUri.join(dirPath, '0/1/2/3');
      const startPath = nuclideUri.join(dirPath, '0/1/2/3/4');
      const foundPath = await fsPromise.findFurthestFile(
        '.some_file',
        startPath,
        true /* stopOnMissing */,
      );
      expect(foundPath).toBe(expectedPath);
    });

    it('does not find the file if not existing', async () => {
      const startPath = nuclideUri.join(dirPath, '0/1/2/3/4');
      const foundPath = await fsPromise.findFurthestFile(
        'non-existent.txt',
        startPath,
      );
      expect(foundPath).toBe(null);
    });
  });

  describe('getCommonAncestorDirectory', () => {
    it('gets the parent directory', () => {
      expect(
        fsPromise.getCommonAncestorDirectory([
          '/foo/bar.txt',
          '/foo/baz/lol.txt',
        ]),
      ).toBe('/foo');
      expect(
        fsPromise.getCommonAncestorDirectory([
          '/foo/bar/abc/def/abc.txt',
          '/foo/bar/lol.txt',
        ]),
      ).toBe('/foo/bar');
    });
  });

  describe('writeFileAtomic', () => {
    let pathToWriteFile: string;
    beforeEach(() => {
      const tempDir = temp.mkdirSync();
      pathToWriteFile = nuclideUri.join(tempDir, 'test');
    });

    it('can write to a file', async () => {
      await fsPromise.writeFileAtomic(
        pathToWriteFile,
        "I'm a little teapot.\n",
      );
      expect(fs.readFileSync(pathToWriteFile).toString()).toEqual(
        "I'm a little teapot.\n",
      );
      // eslint-disable-next-line no-bitwise
      expect(fs.statSync(pathToWriteFile).mode & 0o777).toEqual(
        0o666 & ~process.umask(), // eslint-disable-line no-bitwise
      );
    });

    it('can write to a file with permissions', async () => {
      await fsPromise.writeFileAtomic(
        pathToWriteFile,
        "I'm a little teapot.\n",
        {mode: 0o700},
      );
      // eslint-disable-next-line no-bitwise
      expect(fs.statSync(pathToWriteFile).mode & 0o777).toEqual(
        0o700, // eslint-disable-line no-bitwise
      );
    });

    it('calls mkdirp', async () => {
      const subPath = nuclideUri.join(pathToWriteFile, 'test');
      await fsPromise.writeFileAtomic(subPath, 'test1234\n');
      expect(fs.readFileSync(subPath).toString()).toEqual('test1234\n');
    });

    it('preserves permissions on files', async () => {
      fs.writeFileSync(pathToWriteFile, 'test');
      fs.chmodSync(pathToWriteFile, 0o700);

      await fsPromise.writeFileAtomic(pathToWriteFile, 'test2');
      expect(fs.readFileSync(pathToWriteFile).toString()).toEqual('test2');
      const stat = fs.statSync(pathToWriteFile);
      // eslint-disable-next-line no-bitwise
      expect(stat.mode & 0o777).toEqual(0o700);
    });

    it('errors if file cannot be written', async () => {
      let err;
      try {
        await fsPromise.writeFileAtomic(
          pathToWriteFile + '/that/is/missing/',
          'something',
        );
      } catch (e) {
        err = e;
      }
      invariant(err != null, 'Expected an error');
    });
  });
});
