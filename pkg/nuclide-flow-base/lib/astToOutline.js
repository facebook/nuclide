'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {FlowOutlineTree, Point} from '..';
import {array} from '../../nuclide-commons';

import type {TokenizedText} from '../../nuclide-tokenized-text';
import {
  keyword,
  className,
  method,
  param,
  string,
  whitespace,
  plain,
} from '../../nuclide-tokenized-text';

type Extent = {
  startPosition: Point;
  endPosition: Point;
}

export function astToOutline(ast: any): Array<FlowOutlineTree> {
  return itemsToTrees(ast.body);
}

function itemsToTrees(items: Array<any>): Array<FlowOutlineTree> {
  return array.compact(items.map(itemToTree));
}

function itemToTree(item: any): ?FlowOutlineTree {
  if (item == null) {
    return null;
  }
  const extent = getExtent(item);
  switch (item.type) {
    case 'FunctionDeclaration':
      return {
        tokenizedText: [
          keyword('function'),
          whitespace(' '),
          method(item.id.name),
          plain('('),
          ...paramsTokenizedText(item.params),
          plain(')'),
        ],
        children: [],
        ...extent,
      };
    case 'ClassDeclaration':
      return {
        tokenizedText: [
          keyword('class'),
          whitespace(' '),
          className(item.id.name),
        ],
        children: itemsToTrees(item.body.body),
        ...extent,
      };
    case 'ClassProperty':
      let paramTokens = [];
      if (item.value && item.value.type === 'ArrowFunctionExpression') {
        paramTokens = [
          plain('('),
          ...paramsTokenizedText(item.value.params),
          plain(')'),
        ];
      }
      return {
        tokenizedText: [
          method(item.key.name),
          plain('='),
          ...paramTokens,
        ],
        children: [],
        ...extent,
      };
    case 'MethodDefinition':
      return {
        tokenizedText: [
          method(item.key.name),
          plain('('),
          ...paramsTokenizedText(item.value.params),
          plain(')'),
        ],
        children: [],
        ...extent,
      };
    case 'ExportDeclaration':
      const tree = itemToTree(item.declaration);
      if (tree == null) {
        return null;
      }
      return {
        tokenizedText: [
          keyword('export'),
          whitespace(' '),
          ...tree.tokenizedText,
        ],
        children: tree.children,
        ...extent,
      };
    case 'ExpressionStatement':
      return specOutline(item, /* describeOnly */ true);
    default:
      return null;
  }
}

function paramsTokenizedText(params: Array<any>): TokenizedText {
  const textElements = [];
  params.forEach((p, index) => {
    textElements.push(param(p.name));
    if (index < params.length - 1) {
      textElements.push(plain(','));
      textElements.push(whitespace(' '));
    }
  });

  return textElements;
}

function getExtent(item: any): Extent {
  return {
    startPosition: {
      // It definitely makes sense that the lines we get are 1-based and the columns are
      // 0-based... convert to 0-based all around.
      line: item.loc.start.line - 1,
      column: item.loc.start.column,
    },
    endPosition: {
      line: item.loc.end.line - 1,
      column: item.loc.end.column,
    },
  };
}

function specOutline(expressionStatement: any, describeOnly: boolean = false): ?FlowOutlineTree {
  const expression = expressionStatement.expression;
  if (expression.type !== 'CallExpression') {
    return null;
  }
  const functionName = expression.callee.name;
  if (functionName !== 'describe') {
    if (describeOnly || functionName !== 'it') {
      return null;
    }
  }
  const description = getStringLiteralValue(expression.arguments[0]);
  const specBody = getFunctionBody(expression.arguments[1]);
  if (description == null || specBody == null) {
    return null;
  }
  let children;
  if (functionName === 'it') {
    children = [];
  } else {
    children = array.compact(
      specBody
      .filter(item => item.type === 'ExpressionStatement')
      .map(item => specOutline(item)));
  }
  return {
    tokenizedText: [
      method(expression.callee.name),
      whitespace(' '),
      string(description),
    ],
    children,
    ...getExtent(expressionStatement),
  };
}

/** If the given AST Node is a string literal, return its literal value. Otherwise return null */
function getStringLiteralValue(literal: ?any): ?string {
  if (literal == null) {
    return null;
  }
  if (literal.type !== 'Literal') {
    return null;
  }
  const value = literal.value;
  if (typeof value !== 'string') {
    return null;
  }
  return value;
}

function getFunctionBody(fn: ?any): ?Array<any> {
  if (fn == null) {
    return null;
  }
  if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') {
    return null;
  }
  return fn.body.body;
}
