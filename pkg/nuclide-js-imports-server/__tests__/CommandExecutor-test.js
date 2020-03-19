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
import invariant from 'assert';

import {getEditsForImport} from '../src/CommandExecutor';
import {parseFile} from '../src/lib/AutoImportsManager';
import {ImportFormatter} from '../src/lib/ImportFormatter';

function getProgramBody(src: string) {
  const ast = parseFile(src);
  invariant(ast != null);
  return ast.program.body;
}

describe('CommandExecutor', () => {
  it('can create new imports', () => {
    const importFormatter = new ImportFormatter([], false);
    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        {
          id: 'test',
          uri: '/a/test2.js',
          line: 1,
          isTypeExport: false,
          isDefault: true,
        },
        getProgramBody('function f() {}'),
      ),
    ).toEqual([
      {
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        newText: "import test from './test2';\n\n",
      },
    ]);
  });

  it('can create new requires', () => {
    const importFormatter = new ImportFormatter([], true);
    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        {
          id: 'test',
          uri: '/a/test2.js',
          line: 1,
          hasteName: 'test2',
          isTypeExport: false,
          isDefault: true,
        },
        getProgramBody('function f() {}'),
      ),
    ).toEqual([
      {
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        newText: "const test = require('test2');\n\n",
      },
    ]);

    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        {
          id: 'test',
          uri: '/a/test2.js',
          line: 1,
          hasteName: 'test2',
          isTypeExport: false,
          isDefault: false,
        },
        getProgramBody('function f() {}\nlet fake;'),
      ),
    ).toEqual([
      {
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 0}},
        newText: "const {test} = require('test2');\n\n",
      },
    ]);
  });

  it('preserves ordering of imports', () => {
    const sourceFile = `
import type {x} from 'def';

import {x} from 'abc';
import {y} from 'def';
import {z} from '../relative';
import {w} from './local';
`;

    const importFormatter = new ImportFormatter(['node_modules'], false);
    function getExport(id, uri, isTypeExport = false, isDefault = false) {
      return {id, uri, line: 1, isTypeExport, isDefault};
    }

    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        getExport('test', 'node_modules/abc', true),
        getProgramBody(sourceFile),
      ),
    ).toEqual([
      {
        range: {start: {line: 1, character: 0}, end: {line: 1, character: 0}},
        newText: "import type {test} from 'abc';\n",
      },
    ]);

    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        getExport('test', 'node_modules/ghi', true),
        getProgramBody(sourceFile),
      ),
    ).toEqual([
      {
        range: {start: {line: 2, character: 0}, end: {line: 2, character: 0}},
        newText: "import type {test} from 'ghi';\n",
      },
    ]);

    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        getExport('test', '/abc.js'),
        getProgramBody(sourceFile),
      ),
    ).toEqual([
      {
        range: {start: {line: 5, character: 0}, end: {line: 5, character: 0}},
        newText: "import {test} from '../abc';\n",
      },
    ]);

    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        getExport('test', '/a/abc.js'),
        getProgramBody(sourceFile),
      ),
    ).toEqual([
      {
        range: {start: {line: 6, character: 0}, end: {line: 6, character: 0}},
        newText: "import {test} from './abc';\n",
      },
    ]);

    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        getExport('test', '/a/xyz.js'),
        getProgramBody(sourceFile),
      ),
    ).toEqual([
      {
        range: {start: {line: 7, character: 0}, end: {line: 7, character: 0}},
        newText: "import {test} from './xyz';\n",
      },
    ]);
  });

  it('can insert into existing imports', () => {
    const importFormatter = new ImportFormatter([], false);
    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        {
          id: 'b',
          uri: '/a/test2.js',
          line: 1,
          isTypeExport: false,
          isDefault: false,
        },
        getProgramBody(
          "import type {a} from './test2';\nimport {a} from './test2';",
        ),
      ),
    ).toEqual([
      {
        range: {start: {line: 1, character: 9}, end: {line: 1, character: 9}},
        newText: ', b',
      },
    ]);

    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        {
          id: 'c',
          uri: '/a/test2.js',
          line: 1,
          isTypeExport: false,
          isDefault: false,
        },
        getProgramBody("const {a, b} = require('./test2');"),
      ),
    ).toEqual([
      {
        range: {start: {line: 0, character: 11}, end: {line: 0, character: 11}},
        newText: ', c',
      },
    ]);

    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        {
          id: 'newType',
          uri: '/a/test2.js',
          line: 1,
          isTypeExport: true,
          isDefault: false,
        },
        getProgramBody(
          [
            'import type {',
            '  type1,',
            '  type2,',
            '  type3,',
            '  type4,',
            '} from "./test2"',
          ].join('\n'),
        ),
      ),
    ).toEqual([
      {
        range: {start: {line: 4, character: 7}, end: {line: 4, character: 7}},
        newText: ',\n  newType',
      },
    ]);
  });

  it('groups imports/requires with their own kind', () => {
    const sourceFile = `
import type {x} from 'def';

import {x} from 'abc';

const z = require('xyz');
const {w} = require('ghi');
`;

    const importFormatter = new ImportFormatter(['node_modules'], true);
    function getExport(id, uri, isTypeExport = false, isDefault = false) {
      return {id, uri, line: 1, isTypeExport, isDefault};
    }

    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        getExport('test', 'node_modules/def', false),
        getProgramBody(sourceFile),
      ),
    ).toEqual([
      {
        range: {start: {line: 5, character: 0}, end: {line: 5, character: 0}},
        newText: "const {test} = require('def');\n",
      },
    ]);

    importFormatter.useRequire = false;
    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        getExport('test', 'node_modules/def', false),
        getProgramBody(sourceFile),
      ),
    ).toEqual([
      {
        range: {start: {line: 4, character: 0}, end: {line: 4, character: 0}},
        newText: "import {test} from 'def';\n",
      },
    ]);

    expect(
      getEditsForImport(
        importFormatter,
        '/a/test.js',
        getExport('test', 'node_modules/ghi', true),
        getProgramBody(sourceFile),
      ),
    ).toEqual([
      {
        range: {start: {line: 2, character: 0}, end: {line: 2, character: 0}},
        newText: "import type {test} from 'ghi';\n",
      },
    ]);
  });
});
