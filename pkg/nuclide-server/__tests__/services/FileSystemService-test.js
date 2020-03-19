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
import typeof * as FileSystemService from '../../lib/services/FileSystemService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import ServiceTestHelper from '../../__mocks__/services/ServiceTestHelper';
import invariant from 'assert';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import rimraf from 'rimraf';
import temp from 'temp';

temp.track();

const pathToTestDir = nuclideUri.join(__dirname, '../../__mocks__/testfiles');
const pathToTestFile = nuclideUri.join(pathToTestDir, 'testfile.txt');
const pathToWriteFile = pathToTestFile + '.1';
const pathToLinkFile = pathToTestFile + '.2';
const pathToBrokenLinkFile = pathToTestFile + '.3';
const pathToMissingFile = pathToTestFile + '.oops';

describe('FileSystemService', () => {
  let testHelper;
  let service: FileSystemService;
  beforeEach(async () => {
    testHelper = new ServiceTestHelper();
    const FILE_SYSTEM_SERVICE_PATH = require.resolve(
      '../../lib/services/FileSystemService',
    );
    await testHelper.start([
      {
        name: 'FileSystemService',
        definition: FILE_SYSTEM_SERVICE_PATH,
        implementation: FILE_SYSTEM_SERVICE_PATH,
      },
    ]);
    service = testHelper.getRemoteService('FileSystemService');
  });

  it('can readFile', async () => {
    const body = await service.readFile(pathToTestFile);
    expect(body.toString()).toEqual("I'm a little teapot.\n");
  });

  it('returns 500 code if file cannot be opened', async () => {
    let err;
    try {
      await service.readFile(pathToMissingFile);
    } catch (e) {
      err = e;
    }
    invariant(err != null);
    expect(err).toMatch('ENOENT');
  });

  it('can writeFile', async () => {
    await service.writeFile(pathToWriteFile, "I'm a little teapot.\n");
    expect(fs.readFileSync(pathToWriteFile).toString()).toEqual(
      "I'm a little teapot.\n",
    );
  });

  function normalizeStat(stat: Object) {
    // Access time will naturally differ between calls.
    delete stat.atime;
    // "Ms" fields are new to Node 8 and are not currently supported.
    Object.keys(stat).forEach(key => {
      if (key.endsWith('Ms')) {
        delete stat[key];
      }
    });
  }

  it('can stat', async () => {
    const stats = await service.stat(pathToTestFile);
    const expected = fs.statSync(pathToTestFile);
    expect(normalizeStat(stats)).toEqual(normalizeStat(expected));
  });

  it('can readdir', async () => {
    await (async () => {
      fs.symlinkSync(pathToTestFile, pathToLinkFile, 'file');
      fs.symlinkSync(pathToMissingFile, pathToBrokenLinkFile, 'file');
      const entries = await service.readdir(pathToTestDir);
      expect(entries.length).toBe(2); // Skips broken link
      entries.sort((a, b) => {
        return a[0].localeCompare(b[0]);
      });

      expect(entries[0]).toEqual(['testfile.txt', true, false]);
      expect(entries[1]).toEqual(['testfile.txt.2', true, true]);
    })();
  });

  it('can readdirSorted', async () => {
    fs.symlinkSync(pathToTestFile, pathToLinkFile, 'file');
    fs.symlinkSync(pathToMissingFile, pathToBrokenLinkFile, 'file');
    const entries = await service.readdirSorted(pathToTestDir);
    expect(entries.length).toBe(2); // Skips broken link
    expect(entries[0]).toEqual(['testfile.txt', true, false]);
    expect(entries[1]).toEqual(['testfile.txt.2', true, true]);
  });

  describe('readdirRecursive()', () => {
    const testDir: string = nuclideUri.join(__dirname, 'readdirRecursive_test');

    beforeEach(() => {
      fs.mkdirSync(testDir);

      fs.writeFileSync(nuclideUri.join(testDir, 'testfile.txt'), '');
      fs.mkdirSync(nuclideUri.join(testDir, 'subdir'));
      fs.symlinkSync(
        nuclideUri.join(testDir, 'testfile.txt'),
        nuclideUri.join(testDir, 'subdir', 'testsymlink.txt'),
        'file',
      );

      fs.mkdirSync(nuclideUri.join(testDir, 'subdir', 'a'));
      fs.mkdirSync(nuclideUri.join(testDir, 'subdir', 'a', 'b'));
      fs.mkdirSync(nuclideUri.join(testDir, 'subdir', 'a', 'b', 'c'));
      fs.writeFileSync(
        nuclideUri.join(testDir, 'subdir', 'a', 'b', 'c', 'deepfile.txt'),
        '',
      );
    });

    afterEach(() => {
      rimraf.sync(testDir);
    });

    it('can readdirRecursive', async () => {
      const entries = await service.readdirRecursive(testDir);
      expect(entries).toEqual([
        ['subdir', false, false],
        ['subdir/a', false, false],
        ['subdir/a/b', false, false],
        ['subdir/a/b/c', false, false],
        ['subdir/a/b/c/deepfile.txt', true, false],
        ['subdir/testsymlink.txt', true, true],
        ['testfile.txt', true, false],
      ]);
    });

    it('can readdirRecursive with a limit', async () => {
      const entries = await service.readdirRecursive(testDir, 5);
      expect(entries).toEqual([
        ['subdir', false, false],
        ['subdir/a', false, false],
        ['subdir/a/b', false, false],
        ['subdir/a/b/c', false, false],
        ['subdir/a/b/c/deepfile.txt', true, false],
      ]);
    });
  });

  it('can lstat', async () => {
    fs.symlinkSync(pathToTestFile, pathToLinkFile, 'file');
    const lstats = await service.lstat(pathToLinkFile);
    const expected = fs.lstatSync(pathToLinkFile);
    expect(normalizeStat(lstats)).toEqual(normalizeStat(expected));
  });

  it('returns false from exists if file missing', async () => {
    const exists = await service.exists(pathToMissingFile);
    expect(exists).toBe(false);
  });

  it('returns true from exists if file exists', async () => {
    const exists = await service.exists(pathToTestFile);
    expect(exists).toBe(true);
  });

  describe('newFile()', () => {
    let dirPath: string = (null: any);

    beforeEach(() => {
      dirPath = nuclideUri.join(__dirname, 'newFile_test');
    });

    afterEach(() => {
      rimraf.sync(dirPath);
    });

    it('creates the file and the expected subdirectories', async () => {
      const newPath = nuclideUri.join(dirPath, 'foo/bar/baz.txt');
      expect(fs.existsSync(newPath)).toBe(false);
      const isNew = await service.newFile(newPath);
      expect(fs.existsSync(newPath)).toBe(true);
      expect(fs.statSync(newPath).isFile()).toBe(true);
      expect(fs.readFileSync(newPath).toString()).toBe('');
      expect(isNew).toBe(true);
    });

    it('is a no-op for an existing file', async () => {
      fs.mkdirSync(dirPath);
      fs.mkdirSync(nuclideUri.join(dirPath, 'foo'));
      fs.mkdirSync(nuclideUri.join(dirPath, 'foo/bar'));
      const newPath = nuclideUri.join(dirPath, 'foo/bar/baz.txt');
      fs.writeFileSync(newPath, 'contents');
      expect(fs.existsSync(newPath)).toBe(true);

      const isNew = await service.newFile(newPath);
      expect(fs.statSync(newPath).isFile()).toBe(true);
      expect(fs.readFileSync(newPath).toString()).toBe('contents');
      expect(isNew).toBe(false);
    });
  });

  describe('realpath()', () => {
    it('gets the same exact path of a normal file', async () => {
      const realpath = await service.realpath(pathToTestFile);
      expect(realpath).toBe(testHelper.getUriOfRemotePath(pathToTestFile));
    });

    it('gets the real path of a symlinked file', async () => {
      fs.symlinkSync(pathToTestFile, pathToLinkFile, 'file');
      const realpath = await service.realpath(pathToLinkFile);
      expect(realpath).toBe(testHelper.getUriOfRemotePath(pathToTestFile));
    });
  });

  describe('rename()', () => {
    let dirPath;

    beforeEach(() => {
      dirPath = temp.mkdirSync('rename_test');
    });

    it('succeeds when renaming a file', async () => {
      const sourcePath = nuclideUri.join(dirPath, 'file');
      fs.writeFileSync(sourcePath, '');
      const destinationPath = nuclideUri.join(dirPath, 'destination_file');

      await service.rename(sourcePath, destinationPath);

      expect(fs.existsSync(sourcePath)).toBe(false);
      expect(fs.existsSync(destinationPath)).toBe(true);
    });

    it('succeeds when renaming a folder', async () => {
      const sourcePath = nuclideUri.join(dirPath, 'directory');
      fs.mkdirSync(sourcePath);
      const destinationPath = nuclideUri.join(dirPath, 'destination_folder');

      await service.rename(sourcePath, destinationPath);

      expect(fs.existsSync(sourcePath)).toBe(false);
      expect(fs.existsSync(destinationPath)).toBe(true);
    });

    it('succeeds when renaming into a non-existent directory', async () => {
      const sourcePath = nuclideUri.join(dirPath, 'file');
      fs.writeFileSync(sourcePath, '');
      const destinationPath = nuclideUri.join(
        dirPath,
        'non-existent',
        'destination_file',
      );

      await service.rename(sourcePath, destinationPath);

      expect(fs.existsSync(sourcePath)).toBe(false);
      expect(fs.existsSync(destinationPath)).toBe(true);
    });

    it('throws error if the source does not exist', async () => {
      const sourcePath = nuclideUri.join(dirPath, 'file');
      const destinationPath = nuclideUri.join(dirPath, 'destination_file');

      let err;
      try {
        await service.rename(sourcePath, destinationPath);
      } catch (e) {
        err = e;
      }

      invariant(err != null);
      expect(err).toMatch('ENOENT');
      expect(fs.existsSync(destinationPath)).toBe(false);
    });

    it('throws error if the destination exists', async () => {
      const sourcePath = nuclideUri.join(dirPath, 'file');
      fs.writeFileSync(sourcePath, '');
      const destinationPath = nuclideUri.join(dirPath, 'destination_file');
      fs.writeFileSync(destinationPath, '');

      let err;
      try {
        await service.rename(sourcePath, destinationPath);
      } catch (e) {
        err = e;
      }

      invariant(err != null);
      expect(err.code).toMatch('EEXIST');
    });
  });

  describe('mkdir()', () => {
    let dirPath: string = (null: any);

    beforeEach(() => {
      dirPath = nuclideUri.join(__dirname, 'mkdir_test');
    });

    afterEach(() => {
      if (fs.existsSync(dirPath)) {
        fs.rmdirSync(dirPath);
      }
    });

    it('creates a directory at a given path', async () => {
      expect(fs.existsSync(dirPath)).toBe(false);
      await service.mkdir(dirPath);
      expect(fs.existsSync(dirPath)).toBe(true);
      expect(fs.statSync(dirPath).isDirectory()).toBe(true);
    });

    it('throws an error if already existing directory', async () => {
      let err;
      fs.mkdirSync(dirPath);
      try {
        await service.mkdir(dirPath);
      } catch (e) {
        err = e;
      }
      invariant(err != null);
      expect(err).toMatch('EEXIST');
    });

    it('throws an error if the path is nested in a non-existing directory', async () => {
      let err;
      try {
        await service.mkdir(nuclideUri.join(dirPath, 'foo'));
      } catch (e) {
        err = e;
      }
      invariant(err != null);
      expect(err).toMatch('ENOENT');
    });
  });

  describe('mkdirp()', () => {
    let dirPath: string = (null: any);

    beforeEach(() => {
      dirPath = nuclideUri.join(__dirname, 'mkdirp_test');
    });

    afterEach(() => {
      rimraf.sync(dirPath);
    });

    it('creates the expected subdirectories', async () => {
      const newPath = nuclideUri.join(dirPath, 'foo/bar/baz');
      expect(fs.existsSync(newPath)).toBe(false);
      const isNew = await service.mkdirp(newPath);
      expect(fs.existsSync(newPath)).toBe(true);
      expect(isNew).toBe(true);
    });

    it('is a no-op for an existing directory', async () => {
      fs.mkdirSync(dirPath);
      fs.mkdirSync(nuclideUri.join(dirPath, 'foo'));
      fs.mkdirSync(nuclideUri.join(dirPath, 'foo/bar'));
      const newPath = nuclideUri.join(dirPath, 'foo/bar/baz');
      fs.mkdirSync(newPath);
      expect(fs.existsSync(newPath)).toBe(true);

      const isNew = await service.mkdirp(newPath);
      expect(fs.existsSync(newPath)).toBe(true);
      expect(isNew).toBe(false);
    });
  });

  describe('rmdir()', () => {
    let dirPath;

    beforeEach(() => {
      dirPath = temp.mkdirSync('rmdir_test');
    });

    it('removes non-empty directories', async () => {
      const directoryToRemove = nuclideUri.join(dirPath, 'foo');
      await service.mkdirp(nuclideUri.join(directoryToRemove, 'bar'));
      expect(fs.existsSync(directoryToRemove)).toBe(true);
      await service.rmdir(directoryToRemove);
      expect(fs.existsSync(directoryToRemove)).toBe(false);
    });

    it('does nothing for non-existent directories', async () => {
      const directoryToRemove = nuclideUri.join(dirPath, 'foo');
      await service.rmdir(directoryToRemove);
      expect(fs.existsSync(directoryToRemove)).toBe(false);
    });
  });

  describe('unlink()', () => {
    let dirPath;

    beforeEach(() => {
      dirPath = temp.mkdirSync('unlink_test');
    });

    it('removes file if it exists', async () => {
      const fileToRemove = nuclideUri.join(dirPath, 'foo');
      fs.writeFileSync(fileToRemove, '');
      expect(fs.existsSync(fileToRemove)).toBe(true);
      await service.unlink(fileToRemove);
      expect(fs.existsSync(fileToRemove)).toBe(false);
    });

    it('does nothing for non-existent files', async () => {
      const fileToRemove = nuclideUri.join(dirPath, 'foo');
      await service.unlink(fileToRemove);
      expect(fs.existsSync(fileToRemove)).toBe(false);
    });
  });

  describe('chmod()', () => {
    let dirPath = null;
    let testFilePath = null;

    beforeEach(() => {
      dirPath = temp.mkdirSync('chmod_test');
      testFilePath = nuclideUri.join(dirPath, 'foo');
      fs.writeFileSync(testFilePath, '');
      fs.chmodSync(testFilePath, '0644');
    });

    afterEach(() => {
      if (dirPath != null) {
        service.rmdir(dirPath);
      }
    });

    it.skip('can change permissions', async () => {
      invariant(testFilePath != null);
      // chmod 0777
      await service.chmod(testFilePath, 511);
      expect(fs.statSync(testFilePath).mode % 512).toBe(511);
    });
  });

  describe('findNearestAncestorNamed', () => {
    let dirPath: string = (null: any);

    beforeEach(() => {
      dirPath = temp.mkdirSync('findNearestAncestorNamed_test');
      fs.mkdirSync(nuclideUri.join(dirPath, 'foo'));
      fs.mkdirSync(nuclideUri.join(dirPath, 'foo', 'bar'));
      fs.mkdirSync(nuclideUri.join(dirPath, 'foo', 'bar', 'baz'));
      fs.mkdirSync(nuclideUri.join(dirPath, 'boo'));
      const filePaths = [
        nuclideUri.join(dirPath, 'foo', 'BUCK'),
        nuclideUri.join(dirPath, 'foo', 'bar', 'baz', 'BUCK'),
      ];
      filePaths.forEach(filePath => fs.writeFileSync(filePath, 'any contents'));
    });

    it.skip('findNearestAncestorNamed in dir', async () => {
      const pathToDirectory1 = nuclideUri.join(dirPath, 'foo');
      const nearestFile1 = await service.findNearestAncestorNamed(
        'BUCK',
        pathToDirectory1,
      );
      expect(nearestFile1).toBe(nuclideUri.join(dirPath, 'foo', 'BUCK'));

      const pathToDirectory2 = nuclideUri.join(dirPath, 'foo', 'bar', 'baz');
      const nearestFile2 = await service.findNearestAncestorNamed(
        'BUCK',
        pathToDirectory2,
      );
      expect(nearestFile2).toBe(
        nuclideUri.join(dirPath, 'foo', 'bar', 'baz', 'BUCK'),
      );
    });

    it.skip('findNearestAncestorNamed in ancestor', async () => {
      const pathToDirectory = nuclideUri.join(dirPath, 'foo', 'bar');
      const nearestFile = await service.findNearestAncestorNamed(
        'BUCK',
        pathToDirectory,
      );
      expect(nearestFile).toBe(nuclideUri.join(dirPath, 'foo', 'BUCK'));
    });

    it('findNearestAncestorNamed not in ancestor', async () => {
      const pathToDirectory = nuclideUri.join(dirPath, 'boo');
      const nearestFile = await service.findNearestAncestorNamed(
        'BUCK',
        pathToDirectory,
      );
      expect(nearestFile).toBe(null);
    });
  });

  describe('findFilesInDirectories()', () => {
    let dirPath: string = (null: any);
    let fileName: string = (null: any);
    let filePaths: Array<string> = (null: any);

    function toLocalPaths(fileUris: Array<NuclideUri>): Array<string> {
      return fileUris.map(fileUri => nuclideUri.getPath(fileUri));
    }

    beforeEach(() => {
      dirPath = nuclideUri.join(__dirname, 'find_in_dir');
      fileName = 'file.txt';

      fs.mkdirSync(dirPath);
      fs.mkdirSync(nuclideUri.join(dirPath, 'foo'));
      fs.mkdirSync(nuclideUri.join(dirPath, 'foo', 'bar'));
      fs.mkdirSync(nuclideUri.join(dirPath, 'baz'));
      // A directory with the same file name won't be matched.
      fs.mkdirSync(nuclideUri.join(dirPath, 'foo', fileName));

      filePaths = [
        nuclideUri.join(dirPath, fileName),
        nuclideUri.join(dirPath, 'baz', fileName),
        nuclideUri.join(dirPath, 'baz', 'other_file1'),
        nuclideUri.join(dirPath, 'foo', 'other_file2'),
        nuclideUri.join(dirPath, 'foo', 'bar', 'other_file3'),
        nuclideUri.join(dirPath, 'foo', 'bar', fileName),
      ];
      filePaths.forEach(filePath => fs.writeFileSync(filePath, 'any contents'));
    });

    afterEach(() => {
      rimraf.sync(dirPath);
    });

    it('errors when no search directories are provided', async () => {
      let error;
      try {
        await service
          .findFilesInDirectories([], fileName)
          .refCount()
          .toPromise();
      } catch (e) {
        error = e;
      }
      expect(error != null).toBeTruthy();
    });

    it('return empty list when no files are matching', async () => {
      const foundFiles = await service
        .findFilesInDirectories([dirPath], 'not_existing')
        .refCount()
        .toPromise();
      expect(foundFiles.length).toBe(0);
    });

    it('return matching file names in a directory (& nested directories)', async () => {
      const foundFiles = await service
        .findFilesInDirectories([dirPath], fileName)
        .refCount()
        .toPromise();
      expect(foundFiles.length).toBe(3);
      expect(toLocalPaths(foundFiles).sort()).toEqual(
        [filePaths[0], filePaths[1], filePaths[5]].sort(),
      );
    });

    it('return matching file names in specific search directories', async () => {
      const foundFiles = await service
        .findFilesInDirectories(
          [nuclideUri.join(dirPath, 'baz'), nuclideUri.join(dirPath, 'foo')],
          fileName,
        )
        .refCount()
        .toPromise();
      expect(foundFiles.length).toBe(2);
      expect(toLocalPaths(foundFiles).sort()).toEqual(
        [filePaths[1], filePaths[5]].sort(),
      );
    });
  });

  afterEach(() => {
    invariant(testHelper);
    testHelper.stop();
    if (fs.existsSync(pathToWriteFile)) {
      fs.unlinkSync(pathToWriteFile);
    }
    if (fs.existsSync(pathToLinkFile)) {
      fs.unlinkSync(pathToLinkFile);
    }
    try {
      fs.unlinkSync(pathToBrokenLinkFile);
    } catch (e) {
      /* exists can't check for broken symlinks, just absorb the error for cleanup */
    }
  });
});
