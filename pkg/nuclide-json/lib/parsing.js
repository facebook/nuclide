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

import invariant from 'assert';
import {Point, Range} from 'atom';
import * as babylon from '@babel/parser';

type BabelPos = {
  line: number,
  column: number,
};

type BabelLoc = {
  start: BabelPos,
  end: BabelPos,
};

/**
 * Returns a Babel Expression AST node, or null if the parse does not succeed.
 */
export function parseJSON(json: string): ?Object {
  // This messes up the positions but without it, babel won't parse the text as an expression.
  const jsonWithParens = '(\n' + json + '\n)';
  try {
    const ast: Object = babylon.parse(jsonWithParens, {sourceType: 'script'});
    if (ast.type === 'File') {
      invariant(ast.program.body[0].type === 'ExpressionStatement');
      return ast.program.body[0].expression;
    } else if (ast.type === 'Program') {
      invariant(ast.body[0].type === 'ExpressionStatement');
      return ast.body[0].expression;
    }
  } catch (e) {}
  return null;
}

export function babelPosToPoint(pos: BabelPos): atom$Point {
  // Need to subtract 2: one to move from 1-indexed to 0-indexed, another to account for the open
  // paren we had to add on the first line.
  return new Point(pos.line - 2, pos.column);
}

export function babelLocToRange(loc: BabelLoc): atom$Range {
  return new Range(babelPosToPoint(loc.start), babelPosToPoint(loc.end));
}
