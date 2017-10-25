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

import {Range, Point} from 'simple-text-buffer';
import invariant from 'assert';
import fs from 'fs';
import {Subject} from 'rxjs';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {addMatchers} from '../../nuclide-test-helpers';
import * as FileWatcherService from '../../nuclide-filewatcher-rpc';
import ClangServer from '../lib/ClangServer';
import findClangServerArgs from '../lib/find-clang-server-args';

const TEST_FILE = nuclideUri.join(__dirname, 'fixtures', 'test.cpp');
const FILE_CONTENTS = fs.readFileSync(TEST_FILE).toString('utf8');
const EXPECTED_FILE_OUTLINE = [
  {
    name: 'f',
    extent: new Range([0, 0], [1, 1]),
    cursor_kind: 'FUNCTION_DECL',
    params: ['x'],
    tparams: [],
  },
  {
    name: 'main',
    extent: new Range([3, 0], [7, 1]),
    cursor_kind: 'FUNCTION_DECL',
    params: [],
    tparams: [],
  },
];

describe('ClangServer', () => {
  const serverFlags = Promise.resolve({
    flags: [],
    usesDefaultFlags: false,
    flagsFile: null,
  });

  beforeEach(function() {
    addMatchers(this);
  });

  it('can handle requests', () => {
    waitsForPromise(async () => {
      const serverArgs = findClangServerArgs();
      const server = new ClangServer(
        TEST_FILE,
        FILE_CONTENTS,
        serverArgs,
        serverFlags,
      );
      const service = await server.getService();
      let response = await server.compile(FILE_CONTENTS);
      invariant(response);
      expect(response).toEqual({
        diagnostics: [
          {
            severity: 3,
            ranges: [
              {
                file: nuclideUri.join(__dirname, 'fixtures/test.cpp'),
                range: new Range([5, 2], [5, 6]),
              },
            ],
            fixits: [],
            location: {
              point: new Point(5, 2),
              file: nuclideUri.join(__dirname, 'fixtures/test.cpp'),
            },
            spelling: "no matching function for call to 'main'",
            children: [
              {
                location: {
                  point: new Point(3, 4),
                  file: nuclideUri.join(__dirname, 'fixtures/test.cpp'),
                },
                ranges: [],
                spelling:
                  'candidate function not viable: requires 0 arguments, but 1 was provided',
              },
            ],
          },
          {
            severity: 3,
            ranges: null,
            fixits: [
              {
                range: {
                  file: nuclideUri.join(__dirname, 'fixtures/test.cpp'),
                  range: new Range([6, 10], [6, 10]),
                },
                value: ';',
              },
            ],
            location: {
              point: new Point(6, 10),
              file: nuclideUri.join(__dirname, 'fixtures/test.cpp'),
            },
            spelling: "expected ';' after return statement",
            children: [],
          },
        ],
        accurateFlags: true,
      });

      const mem = await server.getMemoryUsage();
      expect(mem).toBeGreaterThan(0);

      response = await service.get_completions(FILE_CONTENTS, 4, 7, 7, 'f');
      invariant(response);
      expect(response.map(x => x.spelling).sort()).toEqual([
        'f(int x)',
        'false',
        'float',
      ]);

      // This will hit the cache. Double-check the result.
      response = await service.get_completions(FILE_CONTENTS, 4, 7, 7, 'fa');
      invariant(response);
      expect(response.map(x => x.spelling).sort()).toEqual(['false']);

      // Function argument completions are a little special.
      response = await service.get_completions(FILE_CONTENTS, 4, 4, 4, '');
      invariant(response);
      expect(response[0].spelling).toBe('f(int x)');
      expect(response[0].cursor_kind).toBe('OVERLOAD_CANDIDATE');

      response = await service.get_declaration(FILE_CONTENTS, 4, 2);
      invariant(response);
      const {point, spelling, type} = response;
      expect(point).toEqual(new Point(0, 5));
      expect(spelling).toBe('f');
      expect(type).toBe('void (int)');

      response = await service.get_declaration_info(FILE_CONTENTS, 4, 2);
      invariant(response);
      expect(response.length).toBe(1);
      expect(response[0].name).toBe('f(int)');
      expect(response[0].type).toBe('FUNCTION_DECL');
      // May not be consistent between clang versions.
      expect(response[0].cursor_usr).not.toBe(null);
      expect(response[0].is_definition).toBe(true);

      response = await service.get_outline(FILE_CONTENTS);
      invariant(response);
      expect(response).toEqual(EXPECTED_FILE_OUTLINE);
    });
  });

  it('gracefully handles server crashes', () => {
    waitsForPromise(async () => {
      const serverArgs = findClangServerArgs();
      const server = new ClangServer(
        TEST_FILE,
        FILE_CONTENTS,
        serverArgs,
        serverFlags,
      );
      let response = await server.compile(FILE_CONTENTS);
      expect(response).not.toBe(null);

      const {_process} = server._rpcProcess;
      invariant(_process);
      _process.kill();

      // This request should fail, but cleanup should occur.
      let thrown = false;
      try {
        response = await server.compile(FILE_CONTENTS);
      } catch (e) {
        thrown = true;
      }
      expect(thrown).toBe(true);

      // The next request should work as expected.
      const service = await server.getService();
      response = await service.get_declaration(FILE_CONTENTS, 4, 2);
      expect(response).not.toBe(null);
    });
  });

  it('supports get_local_references', () => {
    waitsForPromise(async () => {
      const file = nuclideUri.join(__dirname, 'fixtures', 'references.cpp');
      const fileContents = fs.readFileSync(file).toString('utf8');
      const serverArgs = findClangServerArgs();
      const server = new ClangServer(
        file,
        fileContents,
        serverArgs,
        serverFlags,
      );
      const service = await server.getService();

      const compileResponse = await server.compile(fileContents);

      invariant(compileResponse != null);
      expect(compileResponse.diagnostics).toEqual([]);

      // param var1
      expect(await service.get_local_references(fileContents, 1, 24)).diffJson({
        cursor_name: 'var1',
        cursor_kind: 'PARM_DECL',
        references: [
          {start: {row: 1, column: 24}, end: {row: 1, column: 28}},
          {start: {row: 2, column: 13}, end: {row: 2, column: 17}},
          {start: {row: 2, column: 20}, end: {row: 2, column: 24}},
          {start: {row: 3, column: 20}, end: {row: 3, column: 24}},
          {start: {row: 4, column: 2}, end: {row: 4, column: 6}},
          {start: {row: 9, column: 9}, end: {row: 9, column: 13}},
          {start: {row: 9, column: 16}, end: {row: 9, column: 20}},
        ],
      });

      // var2 (from a reference)
      expect(await service.get_local_references(fileContents, 4, 9)).diffJson({
        cursor_name: 'var2',
        cursor_kind: 'VAR_DECL',
        references: [
          {start: {row: 2, column: 6}, end: {row: 2, column: 10}},
          {start: {row: 4, column: 9}, end: {row: 4, column: 13}},
        ],
      });

      // var3
      expect(await service.get_local_references(fileContents, 2, 26)).diffJson({
        cursor_name: 'var3',
        cursor_kind: 'VAR_DECL',
        references: [{start: {row: 2, column: 26}, end: {row: 2, column: 30}}],
      });

      // inner var1
      expect(await service.get_local_references(fileContents, 6, 11)).diffJson({
        cursor_name: 'var1',
        cursor_kind: 'VAR_DECL',
        references: [
          {start: {row: 6, column: 11}, end: {row: 6, column: 15}},
          {start: {row: 6, column: 22}, end: {row: 6, column: 26}},
          {start: {row: 6, column: 33}, end: {row: 6, column: 37}},
          {start: {row: 7, column: 11}, end: {row: 7, column: 15}},
        ],
      });

      // nothing
      expect(await service.get_local_references(fileContents, 0, 0)).toBe(null);
      expect(await service.get_local_references(fileContents, 11, 0)).toBe(
        null,
      );
    });
  });

  it('tracks server status', () => {
    const serverArgs = findClangServerArgs();
    const server = new ClangServer(TEST_FILE, '', serverArgs, serverFlags);
    expect(server.getStatus()).toBe('finding_flags');

    waitsFor(() => server.getStatus() === 'compiling', 'compilation');
    waitsFor(() => server.getStatus() === 'ready', 'ready');
  });

  it('listens to flag changes', () => {
    waitsForPromise(async () => {
      const subject = new Subject();
      spyOn(FileWatcherService, 'watchWithNode').andReturn(subject.publish());

      const serverArgs = findClangServerArgs();
      const server = new ClangServer(
        TEST_FILE,
        '',
        serverArgs,
        Promise.resolve({
          flags: [],
          usesDefaultFlags: false,
          flagsFile: '',
        }),
      );

      await server.waitForReady();
      subject.next(null);
      expect(server.getFlagsChanged()).toBe(true);
    });
  });
});
