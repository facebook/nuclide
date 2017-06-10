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
import * as BuckService from '../../nuclide-buck-rpc';
import ClangFlagsManager from '../lib/ClangFlagsManager';
import {copyFixture} from '../../../pkg/nuclide-test-helpers';

describe('ClangFlagsManager', () => {
  let flagsManager: ClangFlagsManager;
  let ownerSpy;
  let buildSpy;
  beforeEach(() => {
    flagsManager = new ClangFlagsManager();
    spyOn(BuckService, 'getRootForPath').andReturn(
      nuclideUri.join(__dirname, 'fixtures'),
    );
    ownerSpy = spyOn(BuckService, 'getOwners').andReturn(
      // Default header targets should be ignored
      ['//test:__default_headers__', '//test'],
    );
    spyOn(BuckService, 'getBuildFile').andReturn(
      nuclideUri.join(__dirname, 'fixtures', 'BUCK'),
    );
    buildSpy = spyOn(BuckService, 'build').andReturn({
      success: true,
      results: {
        '//test#compilation-database': {
          output: 'compile_commands.json',
        },
      },
    });
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
      let result = await flagsManager.getFlagsForSrc('test.cpp');
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);
      expect(nullthrows(result).flagsFile).toEqual(
        nuclideUri.join(__dirname, 'fixtures', 'BUCK'),
      );

      // Make sure this is cached (different file, but same target).
      buildSpy.wasCalled = false;
      result = await flagsManager.getFlagsForSrc('test.h');
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);
      expect(BuckService.build).not.toHaveBeenCalled();

      // Make sure cache gets reset.
      flagsManager.reset();
      result = await flagsManager.getFlagsForSrc('test.cpp');
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);
      expect(BuckService.build).toHaveBeenCalled();
    });
  });

  it('supports negative caching', () => {
    waitsForPromise(async () => {
      // Unowned projects shouldn't invoke Buck again.
      ownerSpy.andReturn([]);
      let result = await flagsManager.getFlagsForSrc('test');
      expect(nullthrows(result).flags).toBe(null);

      ownerSpy.wasCalled = false;
      result = await flagsManager.getFlagsForSrc('test');
      expect(nullthrows(result).flags).toBe(null);
      expect(BuckService.getOwners).not.toHaveBeenCalled();
    });
  });

  it('gets flags for header files', () => {
    waitsForPromise(async () => {
      let result = await flagsManager.getFlagsForSrc('header.h');
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);

      result = await flagsManager.getFlagsForSrc('header.hpp');
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);

      // When headers are not properly owned, we should look for source files
      // in the same directory.
      const spy = ownerSpy.andReturn(['//test:__default_headers__']);
      const dir = nuclideUri.join(__dirname, 'fixtures');
      result = await flagsManager.getFlagsForSrc(
        nuclideUri.join(dir, 'testInternal.h'),
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
      );
      expect(nullthrows(result).flags).toBeNull();

      // Make sure we don't try get flags for non-source files.
      result = await flagsManager.getFlagsForSrc(
        nuclideUri.join(dir, 'compile_commands.h'),
      );
      expect(nullthrows(result).flags).toBeNull();
      expect(spy).not.toHaveBeenCalledWith(
        nuclideUri.join(dir, 'compile_commands.json'),
      );
    });
  });

  it('gets flags from the compilation database', () => {
    waitsForPromise(async () => {
      let testFile = nuclideUri.join(__dirname, 'fixtures', 'test.cpp');
      let result = await flagsManager.getFlagsForSrc(testFile);
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);
      expect(BuckService.build).not.toHaveBeenCalled();

      testFile = nuclideUri.join(__dirname, 'fixtures', 'test.h');
      result = await flagsManager.getFlagsForSrc(testFile);
      expect(nullthrows(result).flags).toEqual(['g++', '-fPIC', '-O3']);

      // Fall back to Buck if it's not in the compilation DB.
      testFile = nuclideUri.join(__dirname, 'fixtures', 'test2.cpp');
      result = await flagsManager.getFlagsForSrc(testFile);
      expect(BuckService.build).toHaveBeenCalled();
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
      let result = await flagsManager.getFlagsForSrc(testFile);
      expect(nullthrows(result).flags).toEqual(expectedFlags);
      expect(BuckService.build).not.toHaveBeenCalled();

      testFile = nuclideUri.join(testDir, 'test.h');
      result = await flagsManager.getFlagsForSrc(testFile);
      expect(nullthrows(result).flags).toEqual(expectedFlags);

      // Fall back to Buck if it's not in the compilation DB.
      testFile = nuclideUri.join(testDir, 'test2.cpp');
      result = await flagsManager.getFlagsForSrc(testFile);
      expect(BuckService.build).toHaveBeenCalled();
      expect(nullthrows(result).flags).toEqual(null);
    });
  });

  it('can guess locations of build files', () => {
    waitsForPromise(async () => {
      const file = await ClangFlagsManager._guessBuildFile(
        nuclideUri.join(__dirname, 'fixtures', 'a.cpp'),
      );
      expect(file).toBe(
        nuclideUri.join(__dirname, 'fixtures', 'compile_commands.json'),
      );
    });
  });
});
