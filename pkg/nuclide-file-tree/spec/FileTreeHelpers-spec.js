'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {
  Directory,
  File,
} from 'atom';
import FileTreeHelpers from '../lib/FileTreeHelpers';
import pathModule from 'path';

describe('FileTreeHelpers', () => {
  it('should convert key to path', () => {
    expect(FileTreeHelpers.keyToPath('/a')).toBe('/a');
    expect(FileTreeHelpers.keyToPath('/a/')).toBe('/a');
    expect(FileTreeHelpers.keyToPath('/a/b//')).toBe('/a/b');
    expect(FileTreeHelpers.keyToPath('nuclide://host:123/a/b//')).toBe('nuclide://host:123/a/b');
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
    expect(FileTreeHelpers.keyToName('nuclide://host:123/a/b/foo//')).toBe('foo');
    expect(FileTreeHelpers.keyToName('asdf')).toBe('asdf');
  });

  it('should determine if a key represents a directory', () => {
    expect(FileTreeHelpers.isDirKey('/a/b/foo')).toBe(false);
    expect(FileTreeHelpers.isDirKey('/a/b/')).toBe(true);
    expect(FileTreeHelpers.isDirKey('/a/b//')).toBe(true);
    expect(FileTreeHelpers.isDirKey('nuclide://host:456/a/b')).toBe(false);
    expect(FileTreeHelpers.isDirKey('nuclide://host:456/a/b/')).toBe(true);
  });

  it('should instantiate a local directory from a key', () => {
    expect(FileTreeHelpers.getDirectoryByKey('/a/') instanceof Directory).toBe(true);
  });

  it('should validate directories', () => {
    const validDir = new Directory('/a/b/c');
    expect(FileTreeHelpers.isValidDirectory(validDir)).toBe(true);
    const badDir = new Directory('nuclide://host:123/a/b/c');
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
      expect(FileTreeHelpers.getEntryByKey('/a/') instanceof Directory)
        .toBe(true);
    });
  });

  describe('on Windows', () => {
    let originalPathModule;

    beforeEach(() => {
      // Clone path module, then override all functions with the Windows version
      originalPathModule = Object.assign({}, pathModule);
      Object.assign(pathModule, pathModule.win32);
    });

    afterEach(() => {
      Object.assign(pathModule, originalPathModule);
    });

    it('should convert key to path', () => {
      expect(FileTreeHelpers.keyToPath('\\a')).toBe('\\a');
      expect(FileTreeHelpers.keyToPath('\\a\\')).toBe('\\a');
      expect(FileTreeHelpers.keyToPath('\\a\\b\\\\')).toBe('\\a\\b');
      expect(FileTreeHelpers.keyToPath('nuclide://host:123\\a\\b\\\\')).toBe('nuclide://host:123\\a\\b');
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
      expect(FileTreeHelpers.keyToName('nuclide://host:123\\a\\b\\foo\\\\')).toBe('foo');
      expect(FileTreeHelpers.keyToName('asdf')).toBe('asdf');
    });

    it('should determine if a key represents a directory', () => {
      expect(FileTreeHelpers.isDirKey('c:\\a\\b\\foo')).toBe(false);
      expect(FileTreeHelpers.isDirKey('c:\\a\\b\\')).toBe(true);
      expect(FileTreeHelpers.isDirKey('c:\\a\\b\\\\')).toBe(true);
      expect(FileTreeHelpers.isDirKey('nuclide://host:456\\a\\b')).toBe(false);
      expect(FileTreeHelpers.isDirKey('nuclide://host:456\\a\\b\\')).toBe(true);
    });

    it('should instantiate a local directory from a key', () => {
      expect(FileTreeHelpers.getDirectoryByKey('\\a\\') instanceof Directory).toBe(true);
    });

    it('should validate directories', () => {
      const validDir = new Directory('c:\\a\\b\\c');
      expect(FileTreeHelpers.isValidDirectory(validDir)).toBe(true);
      const badDir = new Directory('nuclide://host:123\\a\\b\\c');
      expect(FileTreeHelpers.isValidDirectory(badDir)).toBe(false);
    });

    describe('getFileByKey', () => {
      it('instantiates a local file from a key', () => {
        expect(FileTreeHelpers.getFileByKey('\\a.md') instanceof File).toBe(true);
      });
    });

    describe('getEntryByKey', () => {
      it('instantiates a local file from a key', () => {
        expect(FileTreeHelpers.getEntryByKey('\\a.md') instanceof File)
          .toBe(true);
      });

      it('instantiates a local directory from a key', () => {
        expect(FileTreeHelpers.getEntryByKey('\\a\\') instanceof Directory)
          .toBe(true);
      });
    });
  });
});
