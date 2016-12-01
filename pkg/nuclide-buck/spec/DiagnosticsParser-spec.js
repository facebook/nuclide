'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {Range} from 'atom';
import * as nuclideRemoteConnection from '../../nuclide-remote-connection';
import DiagnosticsParser from '../lib/DiagnosticsParser';

describe('DiagnosticsProvider', () => {
  let diagnosticsParser;
  beforeEach(() => {
    diagnosticsParser = new DiagnosticsParser();
    spyOn(nuclideRemoteConnection, 'getFileSystemServiceByNuclideUri').andReturn({
      exists(filename) {
        return Promise.resolve(filename.indexOf('good') !== -1);
      },
    });
  });

  it('matches all lines that look like errors', () => {
    waitsForPromise(async () => {
      const message =
        'good_file.cpp:1:2: test error\n' +
        'good_file.cpp:1:3: note: trace\n' +
        'good_file.cpp:1:4: note: trace2\n' +
        'good_file.cpp:1:2 bad line\n' +
        'good_file.cpp:12: bad line2\n' +
        ':12:2: bad line3\n' +
        'good_file2.cpp:2:3: test error2\n' +
        'good_file2.cpp:2:4: note: trace\n';

      expect(await diagnosticsParser.getDiagnostics(message, 'error', '/')).toEqual([
        {
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good_file.cpp',
          text: 'test error',
          range: new Range([0, 0], [1, 0]),
          trace: [
            {
              type: 'Trace',
              text: 'note: trace',
              filePath: '/good_file.cpp',
              range: new Range([0, 2], [0, 2]),
            },
            {
              type: 'Trace',
              text: 'note: trace2',
              filePath: '/good_file.cpp',
              range: new Range([0, 3], [0, 3]),
            },
          ],
        },
        {
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good_file2.cpp',
          text: 'test error2',
          range: new Range([1, 0], [2, 0]),
          trace: [
            {
              type: 'Trace',
              text: 'note: trace',
              filePath: '/good_file2.cpp',
              range: new Range([1, 3], [1, 3]),
            },
          ],
        },
      ]);
    });
  });

  it('ignores non-existent files', () => {
    waitsForPromise(async () => {
      const message = 'bad_file.cpp:1:2: test error';
      expect(await diagnosticsParser.getDiagnostics(message, 'error', '/')).toEqual([]);
    });
  });

  it('matches a line that looks like a test failure', () => {
    waitsForPromise(async () => {
      const diagnostics = Promise.all([
        diagnosticsParser.getDiagnostics(
          'PASS    <100ms  6 Passed   0 Skipped   0 Failed   FooTests',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'FAIL    <100ms  4 Passed   0 Skipped   1 Failed   BarTests',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'FAILURE BarTests -[BarTests testBaz]: good/path/to/BarTests.m:42: failure description',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'PASS    <100ms  3 Passed   0 Skipped   0 Failed   BazTests',
          'error',
          '/',
        ),
      ]);
      expect(await diagnostics).toEqual([
        [],
        [],
        [{
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good/path/to/BarTests.m',
          text: 'failure description',
          range: {
            start: {
              row: 41,
              column: 0,
            },
            end: {
              row: 42,
              column: 0,
            },
          },
        }],
        [],
      ]);
    });
  });

  it('matches mutiple test failures from the same test', () => {
    waitsForPromise(async () => {
      const diagnostics = Promise.all([
        diagnosticsParser.getDiagnostics(
          'PASS    <100ms  6 Passed   0 Skipped   0 Failed   FooTests',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'FAIL    <100ms  4 Passed   0 Skipped   1 Failed   BarTests',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'FAILURE BarTests -[BarTests testBaz]: good/path/to/BarTests.m:91: failure one',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'good/path/to/BarTests.m:92: failure two',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'good/path/to/BarTests.m:98: failure three',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'PASS    <100ms  3 Passed   0 Skipped   0 Failed   BazTests',
          'error',
          '/',
        ),
      ]);

      expect(await diagnostics).toEqual([
        [],
        [],
        [{
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good/path/to/BarTests.m',
          text: 'failure one',
          range: {
            start: {
              row: 90,
              column: 0,
            },
            end: {
              row: 91,
              column: 0,
            },
          },
        }],
        [{
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good/path/to/BarTests.m',
          text: 'failure two',
          range: {
            start: {
              row: 91,
              column: 0,
            },
            end: {
              row: 92,
              column: 0,
            },
          },
        }],
        [{
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good/path/to/BarTests.m',
          text: 'failure three',
          range: {
            start: {
              row: 97,
              column: 0,
            },
            end: {
              row: 98,
              column: 0,
            },
          },
        }],
        [],
      ]);
    });
  });

  it('matches mutiple test failures', () => {
    waitsForPromise(async () => {
      const diagnostics = Promise.all([
        diagnosticsParser.getDiagnostics(
          'PASS    <100ms  6 Passed   0 Skipped   0 Failed   FooTests',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'FAIL    <100ms  4 Passed   0 Skipped   1 Failed   BarTests',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'FAILURE BarTests -[BarTests testBaz]: good/path/to/BarTests.m:91: failure one',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'PASS    <100ms  3 Passed   0 Skipped   0 Failed   BazTests',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'FAIL    <100ms  1 Passed   0 Skipped   1 Failed   QuxTests',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'FAILURE QuxTests -[QuxTests testNoz]: good/path/to/QuxTests.m:3: failure one',
          'error',
          '/',
        ),
        diagnosticsParser.getDiagnostics(
          'good/path/to/QuxTests.m:25: failure two',
          'error',
          '/',
        ),
      ]);

      expect(await diagnostics).toEqual([
        [],
        [],
        [{
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good/path/to/BarTests.m',
          text: 'failure one',
          range: {
            start: {
              row: 90,
              column: 0,
            },
            end: {
              row: 91,
              column: 0,
            },
          },
        }],
        [],
        [],
        [{
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good/path/to/QuxTests.m',
          text: 'failure one',
          range: {
            start: {
              row: 2,
              column: 0,
            },
            end: {
              row: 3,
              column: 0,
            },
          },
        }],
        [{
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good/path/to/QuxTests.m',
          text: 'failure two',
          range: {
            start: {
              row: 24,
              column: 0,
            },
            end: {
              row: 25,
              column: 0,
            },
          },
        }],
      ]);
    });
  });

  it('matches mutiple test failures, even when they appear in an order not found in Buck', () => {
    waitsForPromise(async () => {
      const diagnostics = Promise.all([
        diagnosticsParser.getDiagnostics(
          'FAILURE BarTests -[FooTests testBar]: good/path/to/FooTests.m:1: failure one',
          'error',
          '/',
        ),
        // Normally Buck would output a line beginning with "FAIL" here, but
        // this test verifies what happens if it doesn't for some reason.
        diagnosticsParser.getDiagnostics(
          'FAILURE BazTests -[BazTests testQux]: good/path/to/BazTests.m:2: failure two',
          'error',
          '/',
        ),
      ]);

      expect(await diagnostics).toEqual([
        [{
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good/path/to/FooTests.m',
          text: 'failure one',
          range: {
            start: {
              row: 0,
              column: 0,
            },
            end: {
              row: 1,
              column: 0,
            },
          },
        }],
        [{
          scope: 'file',
          providerName: 'Buck',
          type: 'Error',
          filePath: '/good/path/to/BazTests.m',
          text: 'failure two',
          range: {
            start: {
              row: 1,
              column: 0,
            },
            end: {
              row: 2,
              column: 0,
            },
          },
        }],
      ]);
    });
  });
});
