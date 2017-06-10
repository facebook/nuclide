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

import type {OutlineTree} from 'atom-ide-ui';

import {Point} from 'simple-text-buffer';

import {addMatchers} from '../../nuclide-test-helpers';

import {astToOutline} from '../lib/astToOutline';

import classASTOld from './fixtures/class-ast-old.json';
import classAST34 from './fixtures/class-ast-v0.34.json';
import jasmineASTOld from './fixtures/jasmine-ast-old.json';
import jasmineAST34 from './fixtures/jasmine-ast-v0.34.json';
import toplevelASTOld from './fixtures/toplevel-ast-old.json';
import toplevelAST34 from './fixtures/toplevel-ast-v0.34.json';
import exportsASTOld from './fixtures/exports-ast-old.json';
import exportsAST34 from './fixtures/exports-ast-v0.34.json';
import exportDefaultArrowFuncAST34
  from './fixtures/export-default-arrow-func-v0.34.json';
import exportDefaultAnonymousFuncAST34
  from './fixtures/export-default-anonymous-func-v0.34.json';
import typesASTOld from './fixtures/types-ast-old.json';
import typesAST34 from './fixtures/types-ast-v0.34.json';

const expectedClassOutline: Array<OutlineTree> = [
  {
    tokenizedText: [
      {value: 'export', kind: 'keyword'},
      {value: ' ', kind: 'whitespace'},
      {value: 'class', kind: 'keyword'},
      {value: ' ', kind: 'whitespace'},
      {value: 'Foo', kind: 'class-name'},
    ],
    representativeName: 'Foo',
    startPosition: new Point(12, 0),
    endPosition: new Point(22, 1),
    children: [
      {
        tokenizedText: [
          {value: 'field', kind: 'method'},
          {value: '=', kind: 'plain'},
        ],
        representativeName: 'field',
        startPosition: new Point(13, 2),
        endPosition: new Point(13, 14),
        children: [],
      },
      {
        tokenizedText: [
          {value: 'bar', kind: 'method'},
          {value: '(', kind: 'plain'},
          {value: 'arg', kind: 'param'},
          {value: ')', kind: 'plain'},
        ],
        representativeName: 'bar',
        startPosition: new Point(15, 2),
        endPosition: new Point(17, 3),
        children: [],
      },
      {
        tokenizedText: [
          {value: 'baz', kind: 'method'},
          {value: '=', kind: 'plain'},
          {value: '(', kind: 'plain'},
          {value: 'arg', kind: 'param'},
          {value: ')', kind: 'plain'},
        ],
        representativeName: 'baz',
        startPosition: new Point(19, 2),
        endPosition: new Point(19, 35),
        children: [],
      },
      {
        tokenizedText: [
          {value: 'foo', kind: 'method'},
          {value: '(', kind: 'plain'},
          {value: 'arg', kind: 'param'},
          {value: ')', kind: 'plain'},
        ],
        representativeName: 'foo',
        startPosition: new Point(21, 2),
        endPosition: new Point(21, 31),
        children: [],
      },
    ],
  },
];

const expectedToplevelOutline: Array<OutlineTree> = [
  {
    tokenizedText: [
      {value: 'function', kind: 'keyword'},
      {value: ' ', kind: 'whitespace'},
      {value: 'baz', kind: 'method'},
      {value: '(', kind: 'plain'},
      {value: 'arg', kind: 'param'},
      {value: ',', kind: 'plain'},
      {value: ' ', kind: 'whitespace'},
      {value: 'a', kind: 'param'},
      {value: ')', kind: 'plain'},
    ],
    representativeName: 'baz',
    startPosition: new Point(12, 0),
    endPosition: new Point(15, 1),
    children: [],
  },
  {
    tokenizedText: [
      {value: 'function', kind: 'keyword'},
      {value: ' ', kind: 'whitespace'},
      {value: 'foo', kind: 'method'},
      {value: '(', kind: 'plain'},
      {value: '{', kind: 'plain'},
      {value: 'bar', kind: 'param'},
      {value: ',', kind: 'plain'},
      {value: ' ', kind: 'whitespace'},
      {value: 'y', kind: 'param'},
      {value: '}', kind: 'plain'},
      {value: ',', kind: 'plain'},
      {value: ' ', kind: 'whitespace'},
      {value: '[', kind: 'plain'},
      {value: 'b', kind: 'param'},
      {value: ']', kind: 'plain'},
      {value: ',', kind: 'plain'},
      {value: ' ', kind: 'whitespace'},
      {value: '...', kind: 'plain'},
      {value: 'bars', kind: 'param'},
      {value: ')', kind: 'plain'},
    ],
    representativeName: 'foo',
    startPosition: new Point(17, 0),
    endPosition: new Point(19, 1),
    children: [],
  },
  {
    tokenizedText: [
      {kind: 'keyword', value: 'function'},
      {kind: 'whitespace', value: ' '},
      {kind: 'method', value: 'funExpr1'},
      {kind: 'plain', value: '('},
      {kind: 'param', value: 'param1'},
      {kind: 'plain', value: ')'},
    ],
    representativeName: 'funExpr1',
    startPosition: new Point(21, 0),
    endPosition: new Point(23, 2),
    children: [],
  },
  {
    tokenizedText: [
      {kind: 'keyword', value: 'function'},
      {kind: 'whitespace', value: ' '},
      {kind: 'method', value: 'funExpr2'},
      {kind: 'plain', value: '('},
      {kind: 'param', value: 'arg1'},
      {kind: 'plain', value: ','},
      {kind: 'whitespace', value: ' '},
      {kind: 'param', value: 'arg2'},
      {kind: 'plain', value: ')'},
    ],
    representativeName: 'funExpr2',
    startPosition: new Point(25, 0),
    endPosition: new Point(27, 2),
    children: [],
  },
  {
    tokenizedText: [
      {kind: 'keyword', value: 'const'},
      {kind: 'whitespace', value: ' '},
      {kind: 'param', value: 'varFoo'},
    ],
    representativeName: 'varFoo',
    startPosition: new Point(29, 0),
    endPosition: new Point(29, 18),
    children: [],
  },
  {
    tokenizedText: [
      {kind: 'keyword', value: 'var'},
      {kind: 'whitespace', value: ' '},
      {kind: 'param', value: 'varBar'},
    ],
    representativeName: 'varBar',
    startPosition: new Point(31, 0),
    endPosition: new Point(31, 16),
    children: [],
  },
  {
    tokenizedText: [
      {kind: 'keyword', value: 'let'},
      {kind: 'whitespace', value: ' '},
      {kind: 'param', value: 'varBaz'},
    ],
    representativeName: 'varBaz',
    startPosition: new Point(33, 0),
    endPosition: new Point(38, 2),
    children: [],
  },
  {
    tokenizedText: [
      {kind: 'keyword', value: 'const'},
      {kind: 'whitespace', value: ' '},
      {kind: 'plain', value: '{'},
      {kind: 'param', value: 'foo'},
      {kind: 'plain', value: ','},
      {kind: 'whitespace', value: ' '},
      {kind: 'param', value: 'bar'},
      {kind: 'plain', value: '}'},
    ],
    startPosition: new Point(40, 0),
    endPosition: new Point(40, 36),
    children: [],
  },
  {
    tokenizedText: [
      {kind: 'keyword', value: 'const'},
      {kind: 'whitespace', value: ' '},
      {kind: 'plain', value: '['},
      {kind: 'param', value: 'baz'},
      {kind: 'plain', value: ']'},
    ],
    startPosition: new Point(41, 0),
    endPosition: new Point(41, 18),
    children: [],
  },
];

const expectedJasmineOutline: Array<OutlineTree> = [
  {
    tokenizedText: [
      {value: 'describe', kind: 'method'},
      {value: ' ', kind: 'whitespace'},
      {value: 'foo', kind: 'string'},
    ],
    representativeName: 'foo',
    startPosition: new Point(12, 0),
    endPosition: new Point(17, 3),
    children: [
      {
        tokenizedText: [
          {value: 'it', kind: 'method'},
          {value: ' ', kind: 'whitespace'},
          {value: 'should work', kind: 'string'},
        ],
        representativeName: 'should work',
        startPosition: new Point(14, 2),
        endPosition: new Point(16, 5),
        children: [],
      },
    ],
  },
  {
    tokenizedText: [
      {value: 'describe', kind: 'method'},
      {value: ' ', kind: 'whitespace'},
      {value: 'bar', kind: 'string'},
    ],
    representativeName: 'bar',
    startPosition: new Point(19, 0),
    endPosition: new Point(22, 3),
    children: [
      {
        tokenizedText: [
          {value: 'it', kind: 'method'},
          {value: ' ', kind: 'whitespace'},
          {value: 'should work with a normal function', kind: 'string'},
        ],
        representativeName: 'should work with a normal function',
        startPosition: new Point(20, 2),
        endPosition: new Point(21, 5),
        children: [],
      },
    ],
  },
];

const expectedExportsOutline: Array<OutlineTree> = [
  {
    tokenizedText: [{value: 'module.exports', kind: 'plain'}],
    startPosition: new Point(12, 0),
    endPosition: new Point(23, 1),
    children: [
      {
        tokenizedText: [
          {value: 'foo', kind: 'string'},
          {value: ':', kind: 'plain'},
        ],
        representativeName: 'foo',
        startPosition: new Point(13, 2),
        endPosition: new Point(13, 8),
        children: [],
      },
      {
        tokenizedText: [
          {value: 'bar', kind: 'method'},
          {value: '(', kind: 'plain'},
          {value: 'arg', kind: 'param'},
          {value: ')', kind: 'plain'},
        ],
        representativeName: 'bar',
        startPosition: new Point(14, 2),
        endPosition: new Point(16, 3),
        children: [],
      },
      {
        tokenizedText: [
          {value: 'baz', kind: 'method'},
          {value: '(', kind: 'plain'},
          {value: 'arg', kind: 'param'},
          {value: ')', kind: 'plain'},
        ],
        representativeName: 'baz',
        startPosition: new Point(17, 2),
        endPosition: new Point(17, 33),
        children: [],
      },
      {
        tokenizedText: [
          {value: 'asdf', kind: 'method'},
          {value: '(', kind: 'plain'},
          {value: 'arg', kind: 'param'},
          {value: ')', kind: 'plain'},
        ],
        representativeName: 'asdf',
        startPosition: new Point(18, 2),
        endPosition: new Point(18, 24),
        children: [],
      },
      {
        tokenizedText: [
          {value: 'jkl', kind: 'method'},
          {value: '(', kind: 'plain'},
          {value: 'arg', kind: 'param'},
          {value: ')', kind: 'plain'},
        ],
        representativeName: 'jkl',
        startPosition: new Point(19, 2),
        endPosition: new Point(19, 27),
        children: [],
      },
      {
        tokenizedText: [
          {value: 'asdfjkl', kind: 'method'},
          {value: '(', kind: 'plain'},
          {value: 'arg', kind: 'param'},
          {value: ')', kind: 'plain'},
        ],
        representativeName: 'asdfjkl',
        startPosition: new Point(20, 2),
        endPosition: new Point(20, 17),
        children: [],
      },
      {
        tokenizedText: [{value: 'thing', kind: 'string'}],
        representativeName: 'thing',
        startPosition: new Point(21, 2),
        endPosition: new Point(21, 7),
        children: [],
      },
      {
        tokenizedText: [
          {value: 'stuff', kind: 'string'},
          {value: ':', kind: 'plain'},
        ],
        representativeName: 'stuff',
        startPosition: new Point(22, 2),
        endPosition: new Point(22, 14),
        children: [],
      },
    ],
  },
  {
    tokenizedText: [
      {value: 'export', kind: 'keyword'},
      {value: ' ', kind: 'whitespace'},
      {value: 'default', kind: 'keyword'},
      {value: ' ', kind: 'whitespace'},
      {value: 'class', kind: 'keyword'},
    ],
    represenativeName: undefined,
    startPosition: new Point(29, 0),
    endPosition: new Point(29, 23),
    children: [],
  },
];

const expectedTypesOutline: Array<OutlineTree> = [
  {
    tokenizedText: [
      {value: 'type', kind: 'keyword'},
      {value: ' ', kind: 'whitespace'},
      {value: 'Foo', kind: 'type'},
    ],
    representativeName: 'Foo',
    startPosition: new Point(12, 0),
    endPosition: new Point(12, 18),
    children: [],
  },
  {
    tokenizedText: [
      {value: 'export', kind: 'keyword'},
      {value: ' ', kind: 'whitespace'},
      {value: 'type', kind: 'keyword'},
      {value: ' ', kind: 'whitespace'},
      {value: 'Bar', kind: 'type'},
    ],
    representativeName: 'Bar',
    startPosition: new Point(13, 0),
    endPosition: new Point(13, 30),
    children: [],
  },
];

const expectedExportDefaultArrowFuncOutline: Array<OutlineTree> = [
  {
    children: [],
    endPosition: new Point(10, 24),
    representativeName: '',
    startPosition: new Point(10, 0),
    tokenizedText: [
      {kind: 'keyword', value: 'export'},
      {kind: 'whitespace', value: ' '},
      {kind: 'keyword', value: 'default'},
      {kind: 'whitespace', value: ' '},
      {kind: 'keyword', value: 'function'},
      {kind: 'whitespace', value: ' '},
      {kind: 'method', value: ''},
      {kind: 'plain', value: '('},
      {kind: 'plain', value: ')'},
    ],
  },
];

const expectedExportDefaultAnonymousFuncOutline: Array<OutlineTree> = [
  {
    children: [],
    endPosition: new Point(10, 28),
    representativeName: '',
    startPosition: new Point(10, 0),
    tokenizedText: [
      {kind: 'keyword', value: 'export'},
      {kind: 'whitespace', value: ' '},
      {kind: 'keyword', value: 'default'},
      {kind: 'whitespace', value: ' '},
      {kind: 'keyword', value: 'function'},
      {kind: 'whitespace', value: ' '},
      {kind: 'method', value: ''},
      {kind: 'plain', value: '('},
      {kind: 'plain', value: ')'},
    ],
  },
];

describe('astToOutline', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  it('should provide a class outline', () => {
    // Old version
    expect(astToOutline(classASTOld).outlineTrees).diffJson(
      expectedClassOutline,
    );
    // Newer, introduced AssignmentPattern for default function args (v0.33), made a bunch of other
    // changes (v0.34)
    expect(astToOutline(classAST34).outlineTrees).diffJson(
      expectedClassOutline,
    );
  });

  it('should provide an outline for miscellaneous top-level statements', () => {
    expect(astToOutline(toplevelASTOld).outlineTrees).diffJson(
      expectedToplevelOutline,
    );
    expect(astToOutline(toplevelAST34).outlineTrees).diffJson(
      expectedToplevelOutline,
    );
  });

  it('should provide an outline for Jasmine specs', () => {
    expect(astToOutline(jasmineASTOld).outlineTrees).diffJson(
      expectedJasmineOutline,
    );
    expect(astToOutline(jasmineAST34).outlineTrees).diffJson(
      expectedJasmineOutline,
    );
  });

  it('should provide an outline for module.exports', () => {
    expect(astToOutline(exportsASTOld).outlineTrees).diffJson(
      expectedExportsOutline,
    );
    expect(astToOutline(exportsAST34).outlineTrees).diffJson(
      expectedExportsOutline,
    );
  });

  it('should provide an outline for type declarations', () => {
    expect(astToOutline(typesASTOld).outlineTrees).diffJson(
      expectedTypesOutline,
    );
    expect(astToOutline(typesAST34).outlineTrees).diffJson(
      expectedTypesOutline,
    );
  });

  it('should provide an outline for export default () => {}', () => {
    expect(astToOutline(exportDefaultArrowFuncAST34).outlineTrees).diffJson(
      expectedExportDefaultArrowFuncOutline,
    );
  });

  it('should provide an outline for export default function() {}', () => {
    expect(astToOutline(exportDefaultAnonymousFuncAST34).outlineTrees).diffJson(
      expectedExportDefaultAnonymousFuncOutline,
    );
  });
});
