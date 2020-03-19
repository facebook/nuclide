/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {OutlineTree} from 'atom-ide-ui';
import type {TextToken} from 'nuclide-commons/tokenized-text';
import type {
  PythonOutlineItem,
  PythonClassItem,
  PythonFunctionItem,
  PythonStatementItem,
} from '../../nuclide-python-rpc';

import {Point} from 'simple-text-buffer';
import {
  keyword,
  method,
  param,
  whitespace,
  plain,
} from 'nuclide-commons/tokenized-text';

type ShowVariableMode = 'none' | 'constants' | 'all';

function itemToOutlineTree(
  mode: ShowVariableMode,
  item: PythonOutlineItem,
): ?OutlineTree {
  switch (item.kind) {
    case 'class':
      return classToOutlineTree('all', item);
    case 'function':
      return functionToOutlineTree(item);
    case 'statement':
      return statementToOutlineTree(mode, item);
  }
}

function classToOutlineTree(
  mode: ShowVariableMode,
  item: PythonClassItem,
): OutlineTree {
  return {
    tokenizedText: [keyword('class'), whitespace(' '), method(item.name)],
    representativeName: item.name,
    children: itemsToOutline(mode, item.children),
    ...itemToPositions(item),
  };
}

function functionToOutlineTree(item: PythonFunctionItem): OutlineTree {
  return {
    tokenizedText: [
      keyword('def'),
      whitespace(' '),
      method(item.name),
      plain('('),
      ...argsToText(item.params || []),
      plain(')'),
    ],
    representativeName: item.name,
    children: [],
    ...itemToPositions(item),
  };
}

function statementToOutlineTree(
  mode: ShowVariableMode,
  item: PythonStatementItem,
): ?OutlineTree {
  if (mode === 'none') {
    return null;
  }
  const name = item.name;
  // Only show initialization of constants, which according to python
  // style are all upper case.
  if (mode === 'constants' && name !== name.toUpperCase()) {
    return null;
  }

  return {
    tokenizedText: [plain(name)],
    representativeName: name,
    children: [],
    ...itemToPositions(item),
  };
}

function argsToText(args: Array<string>): Array<TextToken> {
  const result = [];

  function startArg() {
    if (result.length > 0) {
      result.push(plain(','));
      result.push(whitespace(' '));
    }
  }
  args.forEach(arg => {
    startArg();
    if (arg.startsWith('**')) {
      result.push(plain('**'));
      result.push(param(arg.slice(2)));
    } else if (arg.startsWith('*')) {
      result.push(plain('*'));
      result.push(param(arg.slice(1)));
    } else {
      result.push(param(arg));
    }
  });

  return result;
}

function itemToPositions(
  item: PythonOutlineItem,
): {
  startPosition: atom$Point,
  endPosition: atom$Point,
} {
  const {start, end} = item;
  return {
    startPosition: new Point(start.line - 1, start.column),
    // Outline's endPosition is inclusive, while Jedi's is exclusive.
    // By decrementing the end column, we avoid situations where
    // two items are highlighted at once. End column may end up as -1,
    // which still has the intended effect.
    endPosition: new Point(end.line - 1, end.column - 1),
  };
}

export function itemsToOutline(
  mode: ShowVariableMode,
  items: ?Array<PythonOutlineItem>,
): Array<OutlineTree> {
  if (!items || items.length === 0) {
    return [];
  }
  const result = [];
  items.map(i => itemToOutlineTree(mode, i)).forEach(tree => {
    if (tree) {
      result.push(tree);
    }
  });
  return result;
}
