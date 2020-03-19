/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {
  llbuildYamlPath,
  readCompileCommands,
} from '../../lib/taskrunner/LlbuildYamlParser';
import nuclideUri from 'nuclide-commons/nuclideUri';

describe('llbuildYamlPath', () => {
  const chdir = '/path/to/chdir';
  let configuration: string;
  let buildPath: string;

  describe('when --build-path is not specified', () => {
    beforeEach(() => {
      buildPath = '';
    });

    describe('with --configuration debug', () => {
      beforeEach(() => {
        configuration = 'debug';
      });

      it('returns "/path/to/chdir/.build/debug.yaml"', () => {
        expect(llbuildYamlPath(chdir, configuration, buildPath)).toBe(
          '/path/to/chdir/.build/debug.yaml',
        );
      });
    });

    describe('with --configuration release', () => {
      beforeEach(() => {
        configuration = 'release';
      });

      it('returns "/path/to/chdir/.build/release.yaml"', () => {
        expect(llbuildYamlPath(chdir, configuration, buildPath)).toBe(
          '/path/to/chdir/.build/release.yaml',
        );
      });
    });
  });

  describe('when --build-path is specified', () => {
    beforeEach(() => {
      buildPath = '/build/path';
    });

    describe('with --configuration debug', () => {
      beforeEach(() => {
        configuration = 'debug';
      });

      it('returns "/build/path/debug.yaml"', () => {
        expect(llbuildYamlPath(chdir, configuration, buildPath)).toBe(
          '/build/path/debug.yaml',
        );
      });
    });

    describe('with --configuration release', () => {
      beforeEach(() => {
        configuration = 'release';
      });

      it('returns "/build/path/release.yaml"', () => {
        expect(llbuildYamlPath(chdir, configuration, buildPath)).toBe(
          '/build/path/release.yaml',
        );
      });
    });
  });
});

describe('readCompileCommands', () => {
  let path: string;

  describe('when the file cannot be read', () => {
    beforeEach(() => {
      path = nuclideUri.join(__dirname, '../fixtures/nonexistent.yaml');
    });

    it('returns an empty mapping', async () => {
      const commands = await readCompileCommands(path);
      expect(commands.size).toBe(0);
    });
  });

  describe('when the YAML in the file cannot be parsed', () => {
    beforeEach(() => {
      path = nuclideUri.join(
        __dirname,
        '../../__mocks__/fixtures/invalid.yaml',
      );
    });

    it('throws an error', async () => {
      await expect(readCompileCommands(path)).rejects.toThrow(
        'unexpected end of the stream',
      );
    });
  });

  describe('when the YAML in the file does not contain a "commands" key', () => {
    beforeEach(() => {
      path = nuclideUri.join(
        __dirname,
        '../../__mocks__/fixtures/no-commands.yaml',
      );
    });

    it('returns an empty mapping', async () => {
      const commands = await readCompileCommands(path);
      expect(commands.size).toBe(0);
    });
  });

  describe('when the YAML in the file does not contain any "commands.sources" keys', () => {
    beforeEach(() => {
      path = nuclideUri.join(__dirname, '../fixtures/no-commands-sources.yaml');
    });

    it('returns an empty mapping', async () => {
      const commands = await readCompileCommands(path);
      expect(commands.size).toBe(0);
    });
  });

  describe('when the YAML in the file contains "commands.sources" keys', () => {
    beforeEach(() => {
      path = nuclideUri.join(__dirname, '../../__mocks__/fixtures/valid.yaml');
    });

    it('returns a mapping of sources to "other-args"', async () => {
      const mainPackageArgs = [
        '-module-name',
        'MyPackage',
        '-Onone',
        '-enable-batch-mode',
        '-enforce-exclusivity=checked',
        '-DSWIFT_PACKAGE',
        '-DDEBUG',
        '-DXcode',
        '-Xcc',
        '-I',
        '-Xcc',
        '/path/to/MyPackage/.build/debug',
        '-I',
        '/path/to/MyPackage/.build/debug',
        '-Xcc',
        '-F',
        '-Xcc',
        '/path/to/MyPackage/.build/debug',
        '-F',
        '/path/to/MyPackage/.build/debug',
        '-D',
        'SWIFT_PACKAGE',
        '-g',
        '/path/to/MyPackage/Sources/AnotherSource.swift',
        '/path/to/MyPackage/Sources/MyPackage.swift',
      ];
      const testPackageArgs = [
        '-module-name',
        'MyPackageTestSuite',
        '-Onone',
        '-enable-batch-mode',
        '-enforce-exclusivity=checked',
        '-DSWIFT_PACKAGE',
        '-DDEBUG',
        '-DXcode',
        '-Xcc',
        '-I',
        '-Xcc',
        '/path/to/MyPackage/.build/debug',
        '-I',
        '/path/to/MyPackage/.build/debug',
        '-Xcc',
        '-F',
        '-Xcc',
        '/path/to/MyPackage/.build/debug',
        '-F',
        '/path/to/MyPackage/.build/debug',
        '-D',
        'SWIFT_PACKAGE',
        '-g',
        '/path/to/MyPackage/Tests/MyPackage/MyPackageTests.swift',
      ];
      const commands = await readCompileCommands(path);
      expect(commands.size).toBe(4);
      expect(
        commands.get('/path/to/MyPackage/Sources/MyPackage.swift'),
      ).toEqual(mainPackageArgs);
      expect(
        commands.get('/path/to/MyPackage/Sources/AnotherSource.swift'),
      ).toEqual(mainPackageArgs);
      expect(
        commands.get('/path/to/MyPackage/Tests/MyPackage/MyPackageTests.swift'),
      ).toEqual(testPackageArgs);
      expect(commands.get('/path/to/YetAnotherFile.swift')).toEqual([
        '-module-name',
        '',
        '-Onone',
        '-enable-batch-mode',
        '-enforce-exclusivity=checked',
        '-DSWIFT_PACKAGE',
        '-DDEBUG',
        '-DXcode',
        '/path/to/YetAnotherFile.swift',
      ]);
    });
  });
});
