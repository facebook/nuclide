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
import {arrayCompact} from '../../commons-node/collection';

import type {TokenizedText} from '../../nuclide-tokenized-text';
import {
  keyword,
  className,
  method,
  param,
  string,
  whitespace,
  plain,
  type,
} from '../../nuclide-tokenized-text';

import invariant from 'assert';

type Extent = {
  startPosition: Point,
  endPosition: Point,
};

export function astToOutline(ast: any): Array<FlowOutlineTree> {
  return itemsToTrees(ast.body);
}

function itemsToTrees(items: Array<any>): Array<FlowOutlineTree> {
  return arrayCompact(items.map(itemToTree));
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
        representativeName: item.id.name,
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
        representativeName: item.id.name,
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
        representativeName: item.key.name,
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
        representativeName: item.key.name,
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
        representativeName: tree.representativeName,
        children: tree.children,
        ...extent,
      };
    case 'ExpressionStatement':
      return topLevelExpressionOutline(item);
    case 'TypeAlias':
      return typeAliasOutline(item);
    default:
      return null;
  }
}

function paramsTokenizedText(params: Array<any>): TokenizedText {
  const textElements = [];
  params.forEach((p, index) => {
    switch (p.type) {
      case 'Identifier':
        textElements.push(param(p.name));
        break;
      case 'ObjectPattern':
        textElements.push(plain('{'));
        textElements.push(...paramsTokenizedText(p.properties.map(obj => obj.key)));
        textElements.push(plain('}'));
        break;
      case 'ArrayPattern':
        textElements.push(plain('['));
        textElements.push(...paramsTokenizedText(p.elements));
        textElements.push(plain(']'));
        break;
      default:
        throw new Error(`encountered unexpected argument type ${p.type}`);
    }
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

function typeAliasOutline(typeAliasExpression: any): FlowOutlineTree {
  invariant(typeAliasExpression.type === 'TypeAlias');
  const name = typeAliasExpression.id.name;
  return {
    tokenizedText: [
      keyword('type'),
      whitespace(' '),
      type(name),
    ],
    representativeName: name,
    children: [],
    ...getExtent(typeAliasExpression),
  };
}

function topLevelExpressionOutline(expressionStatement: any): ?FlowOutlineTree {
  switch (expressionStatement.expression.type) {
    case 'CallExpression':
      return specOutline(expressionStatement, /* describeOnly */ true);
    case 'AssignmentExpression':
      return moduleExportsOutline(expressionStatement.expression);
    default:
      return null;
  }
}

function moduleExportsOutline(assignmentStatement: any): ?FlowOutlineTree {
  invariant(assignmentStatement.type === 'AssignmentExpression');

  const left = assignmentStatement.left;
  if (!isModuleExports(left)) {
    return null;
  }

  const right = assignmentStatement.right;
  if (right.type !== 'ObjectExpression') {
    return null;
  }
  const properties: Array<Object> = right.properties;
  return {
    tokenizedText: [plain('module.exports')],
    children: arrayCompact(properties.map(moduleExportsPropertyOutline)),
    ...getExtent(assignmentStatement),
  };
}

function isModuleExports(left: Object): boolean {
  return left.type === 'MemberExpression' &&
    left.object.type === 'Identifier' &&
    left.object.name === 'module' &&
    left.property.type === 'Identifier' &&
    left.property.name === 'exports';
}

function moduleExportsPropertyOutline(property: any): ?FlowOutlineTree {
  invariant(property.type === 'Property');
  if (property.key.type !== 'Identifier') {
    return null;
  }
  const propName = property.key.name;

  if (property.shorthand) {
    // This happens when the shorthand `{ foo }` is used for `{ foo: foo }`
    return {
      tokenizedText: [
        string(propName),
      ],
      representativeName: propName,
      children: [],
      ...getExtent(property),
    };
  }

  if (property.value.type === 'FunctionExpression' ||
    property.value.type === 'ArrowFunctionExpression'
  ) {
    return {
      tokenizedText: [
        method(propName),
        plain('('),
        ...paramsTokenizedText(property.value.params),
        plain(')'),
      ],
      representativeName: propName,
      children: [],
      ...getExtent(property),
    };
  }

  return {
    tokenizedText: [
      string(propName),
      plain(':'),
    ],
    representativeName: propName,
    children: [],
    ...getExtent(property),
  };
}

function specOutline(expressionStatement: any, describeOnly: boolean = false): ?FlowOutlineTree {
  const expression = expressionStatement.expression;
  if (expression.type !== 'CallExpression') {
    return null;
  }
  const functionName = getFunctionName(expression.callee);
  if (functionName == null) {
    return null;
  }
  if (!isDescribe(functionName)) {
    if (describeOnly || !isIt(functionName)) {
      return null;
    }
  }
  const description = getStringLiteralValue(expression.arguments[0]);
  const specBody = getFunctionBody(expression.arguments[1]);
  if (description == null || specBody == null) {
    return null;
  }
  let children;
  if (isIt(functionName)) {
    children = [];
  } else {
    children = arrayCompact(
      specBody
      .filter(item => item.type === 'ExpressionStatement')
      .map(item => specOutline(item)));
  }
  return {
    tokenizedText: [
      method(functionName),
      whitespace(' '),
      string(description),
    ],
    representativeName: description,
    children,
    ...getExtent(expressionStatement),
  };
}

// Return the function name as written as a string. Intended to stringify patterns like `describe`
// and `describe.only` even though `describe.only` is a MemberExpression rather than an Identifier.
function getFunctionName(callee: any): ?string {
  switch (callee.type) {
    case 'Identifier':
      return callee.name;
    case 'MemberExpression':
      if (callee.object.type !== 'Identifier' || callee.property.type !== 'Identifier') {
        return null;
      }
      return `${callee.object.name}.${callee.property.name}`;
    default:
      return null;
  }
}

function isDescribe(functionName: string): boolean {
  switch (functionName) {
    case 'describe':
    case 'fdescribe':
    case 'ddescribe':
    case 'xdescribe':
    case 'describe.only':
    case 'describe.skip':
      return true;
    default:
      return false;
  }
}

function isIt(functionName: string): boolean {
  switch (functionName) {
    case 'it':
    case 'fit':
    case 'iit':
    case 'pit':
    case 'xit':
    case 'it.only':
    case 'it.skip':
      return true;
    default:
      return false;
  }
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
