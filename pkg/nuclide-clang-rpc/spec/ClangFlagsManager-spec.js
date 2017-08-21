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

import nullthrows from 'nullthrows';

import nuclideUri from 'nuclide-commons/nuclideUri';
import ClangFlagsManager from '../lib/ClangFlagsManager';
import {copyFixture} from '../../../pkg/nuclide-test-helpers';
import {guessBuildFile} from '../lib/utils';

describe('ClangFlagsManager', () => {
  let flagsManager: ClangFlagsManager;
  let compilationDatabase;
  let requestSettings;
  let emptyRequestSettings;
  beforeEach(() => {
    flagsManager = new ClangFlagsManager();
    compilationDatabase = {
      file: nuclideUri.join(__dirname, 'fixtures', 'compile_commands.json'),
      flagsFile: nuclideUri.join(__dirname, 'fixtures', 'BUCK'),
      libclangPath: null,
    };
    requestSettings = {
      compilationDatabase,
      projectRoot: null,
    };
    emptyRequestSettings = {
      compilationDatabase: null,
      projectRoot: null,
    };
  });

  it('sanitizeCommand()', () => {
    const {sanitizeCommand} = ClangFlagsManager;

    const originalArgs = [
      '/usr/bin/clang',
      '-mios-simulator-version-min=7.0',
      '-c',
      '-x',
      'objective-c',
      '-std=gnu11',
      '-Wno-deprecated',
      '-Wno-conversion',
      '-fobjc-arc',

      '-F',
      'local/path',
      '-F',
      '/absolute/path',
      '-Flocal/path',
      '-F/absolute/path',

      '-I',
      'local/path',
      '-I',
      '/absolute/path',
      '-Ilocal/path',
      '-I/absolute/path',

      '-include',
      'local/path',
      '-include-pch',
      'local/path',
      '-include',
      '/absolute/path',

      // This is nonsensical, but should not be transformed.
      '-include/absolute/path',

      '-iquote',
      'local/path',
      '-iquote',
      '/absolute/path',

      '-isysroot',
      'local/path',
      '-isysroot',
      '/absolute/path',

      '-isystem',
      'local/path',
      '-isystem',
      '/absolute/path',

      '-fmodules-cache-path=local/path',

      '-o',
      'buck-out/local/path/EXExample.o',
      'local/path/EXExample.m',
    ];
    const buckProjectRoot = '/Users/whoami/project/';
    const sanitizedCommandArgs = sanitizeCommand(
      '/Users/whoami/project/local/path/EXExample.m',
      originalArgs,
      buckProjectRoot,
    );

    const expectedArgs = [
      '/usr/bin/clang',
      '-mios-simulator-version-min=7.0',
      '-c',
      '-x',
      'objective-c',
      '-std=gnu11',
      '-Wno-deprecated',
      '-Wno-conversion',
      '-fobjc-arc',

      '-F',
      buckProjectRoot + 'local/path',
      '-F',
      '/absolute/path',
      '-F' + buckProjectRoot + 'local/path',
      '-F/absolute/path',

      '-I',
      buckProjectRoot + 'local/path',
      '-I',
      '/absolute/path',
      '-I' + buckProjectRoot + 'local/path',
      '-I/absolute/path',

      '-include',
      buckProjectRoot + 'local/path',
      '-include-pch',
      buckProjectRoot + 'local/path',
      '-include',
      '/absolute/path',

      '-include/absolute/path',

      '-iquote',
      buckProjectRoot + 'local/path',
      '-iquote',
      '/absolute/path',

      '-isysroot',
      buckProjectRoot + 'local/path',
      '-isysroot',
      '/absolute/path',

      '-isystem',
      buckProjectRoot + 'local/path',
      '-isystem',
      '/absolute/path',

      `-fmodules-cache-path=${buckProjectRoot}local/path`,
    ];
    expect(sanitizedCommandArgs).toEqual(expectedArgs);
  });

  it('gets flags for a source file', () => {
    waitsForPromise(async () => {
      const srcPath = nuclideUri.join(__dirname, 'fixtures', 'test.cpp');
      let result = await flagsManager.getFlagsForSrc(srcPath, requestSettings);
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);
      expect(nullthrows(result).flagsFile).toEqual(
        nuclideUri.join(__dirname, 'fixtures', 'BUCK'),
      );

      // Make sure this is cached (different file, but same target).
      result = await flagsManager.getFlagsForSrc('test.h', requestSettings);
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);

      // Make sure cache gets reset.
      flagsManager.reset();
      result = await flagsManager.getFlagsForSrc(srcPath, requestSettings);
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);
    });
  });

  it('supports negative caching', () => {
    waitsForPromise(async () => {
      // Unowned projects shouldn't invoke Buck again.
      let result = await flagsManager.getFlagsForSrc('test', requestSettings);
      expect(nullthrows(result).flags).toBe(null);

      result = await flagsManager.getFlagsForSrc('test', requestSettings);
      expect(nullthrows(result).flags).toBe(null);
    });
  });

  it('gets flags for header files', () => {
    waitsForPromise(async () => {
      let result = await flagsManager.getFlagsForSrc(
        'header.h',
        requestSettings,
      );
      expect(nullthrows(result).flags).toEqual([
        'g++',
        '-fPIC',
        '-O3',
        '-x',
        'c++',
      ]);

      result = await flagsManager.getFlagsForSrc('header.hpp', requestSettings);
      expect(nullthrows(result).flags).toEqual([
        'g++',
        '-fPIC',
        '-O3',
        '-x',
        'c++',
      ]);

      // When headers are not properly owned, we should look for source files
      // in the same directory.
      const dir = nuclideUri.join(__dirname, 'fixtures');
      result = await flagsManager.getFlagsForSrc(
        nuclideUri.join(dir, 'testInternal.h'),
        emptyRequestSettings,
      );
      expect(nullthrows(result).flags).toEqual([
        'g++',
        '-fPIC',
        '-O3',
        '-x',
        'c++',
      ]);

      result = await flagsManager.getFlagsForSrc(
        nuclideUri.join(dir, 'test-inl.h'),
        emptyRequestSettings,
      );
      expect(nullthrows(result).flags).toEqual([
        'g++',
        '-fPIC',
        '-O3',
        '-x',
        'c++',
      ]);

      result = await flagsManager.getFlagsForSrc(
        nuclideUri.join(dir, 'test2.h'),
        emptyRequestSettings,
      );
      expect(nullthrows(result).flags).not.toBeNull();
    });
  });

  it('gets flags from the compilation database', () => {
    waitsForPromise(async () => {
      let testFile = nuclideUri.join(__dirname, 'fixtures', 'test.cpp');
      let result = await flagsManager.getFlagsForSrc(
        testFile,
        emptyRequestSettings,
      );
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);

      testFile = nuclideUri.join(__dirname, 'fixtures', 'test.h');
      result = await flagsManager.getFlagsForSrc(
        testFile,
        emptyRequestSettings,
      );
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);

      // Fall back to Buck if it's not in the compilation DB.
      testFile = nuclideUri.join(__dirname, 'fixtures', 'test2.cpp');
      result = await flagsManager.getFlagsForSrc(
        testFile,
        emptyRequestSettings,
      );
      expect(nullthrows(result).flags).toEqual(null);
    });
  });

  it('gets project flags in addition to compilation database flags', () => {
    waitsForPromise(async () => {
      const testDir = await copyFixture('cpp_cmake_project', __dirname);

      const expectedFlags = [
        'g++',
        '-fPIC',
        '-D_THIS_IS_MY_CRAZY_DEFINE',
        '-O2',
        '-isystem',
        '/usr/local/include',
      ];

      let testFile = nuclideUri.join(testDir, 'test.cpp');
      let result = await flagsManager.getFlagsForSrc(
        testFile,
        emptyRequestSettings,
      );
      expect(nullthrows(result).flags).toEqual(expectedFlags);

      testFile = nuclideUri.join(testDir, 'test.h');
      result = await flagsManager.getFlagsForSrc(
        testFile,
        emptyRequestSettings,
      );
      expect(nullthrows(result).flags).toEqual(expectedFlags);
    });
  });

  it('can guess locations of build files', () => {
    waitsForPromise(async () => {
      const file = await guessBuildFile(
        nuclideUri.join(__dirname, 'fixtures', 'a.cpp'),
      );
      expect(file).toBe(
        nuclideUri.join(__dirname, 'fixtures', 'compile_commands.json'),
      );
    });
  });
});
