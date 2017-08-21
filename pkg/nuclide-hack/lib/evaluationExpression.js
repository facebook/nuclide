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

import type {NuclideEvaluationExpression} from '../../nuclide-debugger-interfaces/rpc-types';

import {getDefaultEvaluationExpression} from '../../nuclide-debugger-base';

const HACK_BLACKLISTED_EXPRESSIONS = new Set([
  'final',
  'class',
  'public',
  'async',
  'function',
  'Awaitable',
  'void',
  'string',
  'int',
  'mixed',
  'self',
  'null',
]);

export function getEvaluationExpression(
  editor: atom$TextEditor,
  position: atom$Point,
): ?NuclideEvaluationExpression {
  const exactExpression = getDefaultEvaluationExpression(editor, position);
  const lineContent = editor.lineTextForBufferRow(position.row);
  if (
    exactExpression == null ||
    isBlackListedExpression(exactExpression.expression) ||
    // Shouldn't evaluate function expressions.
    lineContent[exactExpression.range.end.column] === '('
  ) {
    return null;
  }
  return exactExpression;
}

function isBlackListedExpression(expression: string): boolean {
  return HACK_BLACKLISTED_EXPRESSIONS.has(expression);
}
