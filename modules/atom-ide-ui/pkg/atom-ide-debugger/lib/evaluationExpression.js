/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

/**
Originally copied from https://github.com/Microsoft/vscode/blob/b34f17350f2d20dbbbfdb26df91dd50bb9160900/src/vs/workbench/parts/debug/electron-browser/debugHover.ts#L125-L166

MIT License

Copyright (c) 2015 - present Microsoft Corporation

All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import {Range} from 'atom';

export function getDefaultEvaluationExpression(
  editor: atom$TextEditor,
  position: atom$Point,
): ?{
  expression: string,
  range: atom$Range,
} {
  const lineContent = editor.lineTextForBufferRow(position.row);
  let matchingExpression: ?string;
  let startOffset = 0;

  // Some example supported expressions: myVar.prop, a.b.c.d, myVar?.prop, myVar->prop, MyClass::StaticProp, *myVar
  // Match any character except a set of characters which often break interesting sub-expressions
  const expression = /([^()[\]{}<>\s+\-/%~#^;=|,`!]|->)+/g;
  let result;

  // First find the full expression under the cursor
  while ((result = expression.exec(lineContent))) {
    const start = result.index + 1;
    const end = start + result[0].length;

    if (start <= position.column + 1 && end >= position.column + 1) {
      matchingExpression = result[0];
      startOffset = start;
      break;
    }
  }

  // If there are non-word characters after the cursor, we want to truncate the expression then.
  // For example in expression 'a.b.c.d', if the focus was under 'b', 'a.b' would be evaluated.
  if (matchingExpression != null) {
    const subExpression = /\w+/g;
    let subExpressionResult;
    while ((subExpressionResult = subExpression.exec(matchingExpression))) {
      const subEnd =
        subExpressionResult.index +
        1 +
        startOffset +
        subExpressionResult[0].length;
      if (subEnd >= position.column + 1) {
        break;
      }
    }

    if (subExpressionResult) {
      matchingExpression = matchingExpression.substring(
        0,
        subExpression.lastIndex,
      );
    }
  }

  if (matchingExpression == null) {
    return null;
  }

  return {
    expression: matchingExpression,
    range: new Range(
      [position.row, startOffset - 1],
      [position.row, startOffset + matchingExpression.length - 1],
    ),
  };
}
