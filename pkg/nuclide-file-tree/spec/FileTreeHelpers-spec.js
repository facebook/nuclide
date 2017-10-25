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

import {Directory, File} from 'atom';
import FileTreeHelpers from '../lib/FileTreeHelpers';

describe('FileTreeHelpers', () => {
  it('should convert key to path', () => {
    expect(FileTreeHelpers.keyToPath('/a')).toBe('/a');
    expect(FileTreeHelpers.keyToPath('/a/')).toBe('/a');
    expect(FileTreeHelpers.keyToPath('/a/b//')).toBe('/a/b');
    expect(FileTreeHelpers.keyToPath('nuclide://host/a/b//')).toBe(
      'nuclide://host/a/b',
    );
  });

  it('should convert path to key', () => {
    expect(FileTreeHelpers.dirPathToKey('/a')).toBe('/a/');
    expect(FileTreeHelpers.dirPathToKey('/a/')).toBe('/a/');
    expect(FileTreeHelpers.dirPathToKey('/a//')).toBe('/a/');
  });

  it('should convert path to name', () => {
    expect(FileTreeHelpers.keyToName('/a/b/foo')).toBe('foo');
    expect(FileTreeHelpers.keyToName('/a/b/foo/')).toBe('foo');
    expect(FileTreeHelpers.keyToName('/a/b/foo//')).toBe('foo');
    expect(FileTreeHelpers.keyToName('nuclide://host/a/b/foo//')).toBe('foo');
    expect(FileTreeHelpers.keyToName('asdf')).toBe('asdf');
  });

  it('should determine if a key represents a directory', () => {
    expect(FileTreeHelpers.isDirOrArchiveKey('/a/b/foo')).toBe(false);
    expect(FileTreeHelpers.isDirOrArchiveKey('/a/b/')).toBe(true);
    expect(FileTreeHelpers.isDirOrArchiveKey('/a/b//')).toBe(true);
    expect(FileTreeHelpers.isDirOrArchiveKey('nuclide://host/a/b')).toBe(false);
    expect(FileTreeHelpers.isDirOrArchiveKey('nuclide://host/a/b/')).toBe(true);
    expect(FileTreeHelpers.isDirOrArchiveKey('/a.zip')).toBe(true);
    expect(FileTreeHelpers.isDirOrArchiveKey('/a.zip/')).toBe(true);
    expect(FileTreeHelpers.isDirOrArchiveKey('nuclide://host/a.zip')).toBe(
      true,
    );
    expect(FileTreeHelpers.isDirOrArchiveKey('nuclide://host/a.zip/')).toBe(
      true,
    );
  });

  it('should instantiate a local directory from a key', () => {
    expect(FileTreeHelpers.getDirectoryByKey('/a/') instanceof Directory).toBe(
      true,
    );
  });

  it('should validate directories', () => {
    const validDir = new Directory('/a/b/c');
    expect(FileTreeHelpers.isValidDirectory(validDir)).toBe(true);
    const badDir = new Directory('nuclide://host/a/b/c');
    expect(FileTreeHelpers.isValidDirectory(badDir)).toBe(false);
  });

  describe('getFileByKey', () => {
    it('instantiates a local file from a key', () => {
      expect(FileTreeHelpers.getFileByKey('/a.md') instanceof File).toBe(true);
    });
  });

  describe('getEntryByKey', () => {
    it('instantiates a local file from a key', () => {
      expect(FileTreeHelpers.getEntryByKey('/a.md') instanceof File).toBe(true);
    });

    it('instantiates a local directory from a key', () => {
      expect(FileTreeHelpers.getEntryByKey('/a/') instanceof Directory).toBe(
        true,
      );
    });
  });

  describe('on Windows', () => {
    it('should convert key to path', () => {
      expect(FileTreeHelpers.keyToPath('\\a')).toBe('\\a');
      expect(FileTreeHelpers.keyToPath('\\a\\')).toBe('\\a');
      expect(FileTreeHelpers.keyToPath('\\a\\b\\\\')).toBe('\\a\\b');
    });

    it('should convert path to key', () => {
      expect(FileTreeHelpers.dirPathToKey('\\a')).toBe('\\a\\');
      expect(FileTreeHelpers.dirPathToKey('\\a\\')).toBe('\\a\\');
      expect(FileTreeHelpers.dirPathToKey('\\a\\\\')).toBe('\\a\\');
    });

    it('should convert path to name', () => {
      expect(FileTreeHelpers.keyToName('\\a\\b\\foo')).toBe('foo');
      expect(FileTreeHelpers.keyToName('\\a\\b\\foo\\')).toBe('foo');
      expect(FileTreeHelpers.keyToName('\\a\\b\\foo\\\\')).toBe('foo');
      expect(FileTreeHelpers.keyToName('asdf')).toBe('asdf');
    });

    it('should determine if a key represents a directory', () => {
      expect(FileTreeHelpers.isDirOrArchiveKey('c:\\a\\b\\foo')).toBe(false);
      expect(FileTreeHelpers.isDirOrArchiveKey('c:\\a\\b\\')).toBe(true);
      expect(FileTreeHelpers.isDirOrArchiveKey('c:\\a\\b\\\\')).toBe(true);
      expect(FileTreeHelpers.isDirOrArchiveKey('c:\\a.zip')).toBe(true);
      expect(FileTreeHelpers.isDirOrArchiveKey('c:\\a.zip\\')).toBe(true);
    });

    it('should instantiate a local directory from a key', () => {
      expect(
        FileTreeHelpers.getDirectoryByKey('\\a\\') instanceof Directory,
      ).toBe(true);
    });

    it('should validate directories', () => {
      const validDir = new Directory('c:\\a\\b\\c');
      expect(FileTreeHelpers.isValidDirectory(validDir)).toBe(true);
    });

    describe('getFileByKey', () => {
      it('instantiates a local file from a key', () => {
        expect(FileTreeHelpers.getFileByKey('\\a.md') instanceof File).toBe(
          true,
        );
      });
    });

    describe('getEntryByKey', () => {
      it('instantiates a local file from a key', () => {
        expect(FileTreeHelpers.getEntryByKey('\\a.md') instanceof File).toBe(
          true,
        );
      });

      it('instantiates a local directory from a key', () => {
        expect(
          FileTreeHelpers.getEntryByKey('\\a\\') instanceof Directory,
        ).toBe(true);
      });
    });
  });
});
