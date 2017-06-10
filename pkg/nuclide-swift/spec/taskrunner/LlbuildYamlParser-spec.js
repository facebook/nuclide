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

    it('returns an empty mapping', () => {
      waitsForPromise(async () => {
        const commands = await readCompileCommands(path);
        expect(commands.size).toBe(0);
      });
    });
  });

  describe('when the YAML in the file cannot be parsed', () => {
    beforeEach(() => {
      path = nuclideUri.join(__dirname, '../fixtures/invalid.yaml');
    });

    it('throws an error', () => {
      waitsForPromise(async () => {
        // Jasmine toThrow() does not support calling an async function using
        // await, so manually checking for an exception instead.
        let throws = false;
        try {
          await readCompileCommands(path);
        } catch (e) {
          throws = true;
        }
        expect(throws).toBe(true);
      });
    });
  });

  describe('when the YAML in the file does not contain a "commands" key', () => {
    beforeEach(() => {
      path = nuclideUri.join(__dirname, '../fixtures/no-commands.yaml');
    });

    it('returns an empty mapping', () => {
      waitsForPromise(async () => {
        const commands = await readCompileCommands(path);
        expect(commands.size).toBe(0);
      });
    });
  });

  describe('when the YAML in the file does not contain any "commands.sources" keys', () => {
    beforeEach(() => {
      path = nuclideUri.join(__dirname, '../fixtures/no-commands-sources.yaml');
    });

    it('returns an empty mapping', () => {
      waitsForPromise(async () => {
        const commands = await readCompileCommands(path);
        expect(commands.size).toBe(0);
      });
    });
  });

  describe('when the YAML in the file contains "commands.sources" keys', () => {
    beforeEach(() => {
      path = nuclideUri.join(__dirname, '../fixtures/valid.yaml');
    });

    it('returns a mapping of sources to "other-args"', () => {
      waitsForPromise(async () => {
        const commands = await readCompileCommands(path);
        expect(commands.size).toBe(4);
        expect(commands.get('/path/to/MyPackage/Sources/MyPackage.swift')).toBe(
          [
            '-D',
            'SWIFT_PACKAGE',
            '-g',
            '/path/to/MyPackage/Sources/AnotherSource.swift',
            '/path/to/MyPackage/Sources/MyPackage.swift',
          ].join(' '),
        );
        expect(
          commands.get('/path/to/MyPackage/Sources/AnotherSource.swift'),
        ).toBe(
          [
            '-D',
            'SWIFT_PACKAGE',
            '-g',
            '/path/to/MyPackage/Sources/AnotherSource.swift',
            '/path/to/MyPackage/Sources/MyPackage.swift',
          ].join(' '),
        );
        expect(
          commands.get(
            '/path/to/MyPackage/Tests/MyPackage/MyPackageTests.swift',
          ),
        ).toBe(
          [
            '-D',
            'SWIFT_PACKAGE',
            '-g',
            '/path/to/MyPackage/Tests/MyPackage/MyPackageTests.swift',
          ].join(' '),
        );
        expect(commands.get('/path/to/YetAnotherFile.swift')).toBe(
          '/path/to/YetAnotherFile.swift',
        );
      });
    });
  });
});
