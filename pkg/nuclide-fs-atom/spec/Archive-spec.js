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

import {ArchiveDirectory} from '../lib/ArchiveDirectory';
import {ArchiveFile} from '../lib/ArchiveFile';
import {ArchiveFileAsDirectory} from '../lib/ArchiveFileAsDirectory';
import {ROOT_ARCHIVE_FS} from '../../nuclide-fs-atom';

import nuclideUri from 'nuclide-commons/nuclideUri';

type Directory = ArchiveDirectory | ArchiveFileAsDirectory;
type ArchiveEntry = ArchiveDirectory | ArchiveFileAsDirectory | ArchiveFile;

const fixtures = nuclideUri.join(__dirname, 'fixtures');

const PARENT_TEXT = 'Parent directory text file contents\n';
const CHILD_TEXT = 'Child directory text file contents\n';
const PARENT_DIR = [
  'Directory',
  'EmptyDirectory',
  'EmptyFile',
  'LinkDirectory',
  'LinkDirectorySlashTextFile.txt',
  'LinkLinkDirectory',
  'LinkLinkDirectorySlashTextFile.txt',
  'TextFile.txt',
];
const CHILD_DIR = ['LinkDotDotSlashTextFile.txt', 'TextFile.txt'];

const DIR_ZIP_DIR = fixture('dir.zip', 'dir');

describe('dir.zip/dir', () => {
  const dir = ROOT_ARCHIVE_FS.newArchiveDirectory(DIR_ZIP_DIR);
  checkRoot(dir);
});

function checkRoot(root: Directory) {
  describe('root', () => {
    checkGetEntries(root, PARENT_DIR);
  });

  describe('Directory', () => {
    const directory = root.getSubdirectory('Directory');
    checkGetEntries(directory, CHILD_DIR);

    describe('TextFile', () => {
      const directoryTextFile = directory.getFile('TextFile.txt');
      checkTextFile(directoryTextFile, CHILD_TEXT);
    });
  });
  describe('EmptyDirectory', () => {
    const emptyDirectory = root.getSubdirectory('EmptyDirectory');
    checkGetEntries(emptyDirectory, []);
  });
  describe('EmptyFile', () => {
    const emptyFile = root.getFile('EmptyFile');
    checkTextFile(emptyFile, '');
  });
  describe('TextFile', () => {
    const textFile = root.getFile('TextFile.txt');
    checkTextFile(textFile, PARENT_TEXT);
  });
}

function checkGetEntries(directory: Directory, expected: Array<string>): void {
  checkDirectory(directory);
  checkExistingPath(directory);
  describe('getEntries', () => {
    it('returns expected names', () => {
      waitsForPromise(
        () =>
          new Promise((resolve, reject) =>
            directory.getEntries((error, entries) => {
              if (entries != null) {
                expect(names(entries)).toEqual(expected);
                resolve();
              } else {
                reject(error);
              }
            }),
          ),
      );
    });
  });
}

function checkTextFile(entry: ArchiveFile, contents: string) {
  checkFile(entry);
  checkExistingPath(entry);
  checkText(entry, contents);
}

function checkText(entry: ArchiveFile, contents: string): void {
  describe(`text file ${entry.getBaseName()}`, () => {
    it('has expected contents', () => {
      waitsForPromise(async () => {
        expect(await entry.read()).toEqual(contents);
      });
    });
  });
}

function checkDirectory(entry: ArchiveEntry): void {
  describe('directory isDirectory', () => {
    it('is true', () => {
      expect(entry.isDirectory()).toBeTruthy();
    });
  });
  describe('directory isFile', () => {
    it('is false', () => {
      expect(entry.isFile()).toBeFalsy();
    });
  });
}

function checkFile(entry: ArchiveEntry): void {
  describe('file isDirectory', () => {
    it('is false', () => {
      expect(entry.isDirectory()).toBeFalsy();
    });
  });
  describe('file isFile', () => {
    it('is true', () => {
      expect(entry.isFile()).toBeTruthy();
    });
  });
}

function checkExistingPath(entry: ArchiveEntry): void {
  describe('existence', () => {
    it('is true', () => {
      waitsForPromise(async () => {
        expect(await entry.exists()).toBeTruthy();
      });
    });
  });
}

function fixture(dir: string, archiveOffset?: string): string {
  const fsDir = nuclideUri.join(fixtures, dir);
  if (archiveOffset == null) {
    return fsDir;
  } else {
    return nuclideUri.archiveJoin(fsDir, archiveOffset);
  }
}

function names(entries: Array<ArchiveEntry>): Array<string> {
  return entries.map(x => x.getBaseName());
}
