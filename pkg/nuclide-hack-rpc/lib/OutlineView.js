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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {HackRange} from './rpc-types';
import type {Outline, OutlineTree} from 'atom-ide-ui';
import {
  className,
  keyword,
  method,
  whitespace,
  plain,
} from 'nuclide-commons/tokenized-text';

import {atomPointFromHack} from './HackHelpers';

// Note that all line/column values are 1-based.
export type HackSpan = {
  filename: NuclideUri,
  line_start: number,
  char_start: number,
  line_end: number,
  char_end: number,
};

export type HackIdeOutlineItem = {
  kind:
    | 'function'
    | 'class'
    | 'property'
    | 'method'
    | 'const'
    | 'enum'
    | 'typeconst'
    | 'param'
    | 'trait'
    | 'interface',
  name: string,
  position: HackRange,
  id?: ?string,
  span: HackSpan,
  modifiers: ?Array<string>,
  children?: Array<HackIdeOutlineItem>,
  params?: Array<HackIdeOutlineItem>,
  docblock?: string,
};

export type HackIdeOutline = Array<HackIdeOutlineItem>;

export function outlineFromHackIdeOutline(
  hackOutline: HackIdeOutline,
): Outline {
  return {
    outlineTrees: hackOutline.map(outlineFromHackIdeItem),
  };
}

function outlineFromHackIdeItem(hackItem: HackIdeOutlineItem): OutlineTree {
  const tokenizedText = [];

  function addKeyword(value: string) {
    tokenizedText.push(keyword(value));
    tokenizedText.push(whitespace(' '));
  }

  function addModifiers(modifiers: ?Array<string>) {
    if (modifiers != null) {
      modifiers.forEach(addKeyword);
    }
  }

  addModifiers(hackItem.modifiers);
  switch (hackItem.kind) {
    case 'typeconst':
      addKeyword('const');
      addKeyword('type');
      break;
    case 'method':
      addKeyword('function');
      break;
    default:
      addKeyword(hackItem.kind);
      break;
  }

  // name
  switch (hackItem.kind) {
    case 'class':
    case 'enum':
    case 'typeconst':
      tokenizedText.push(className(hackItem.name));
      break;
    default:
      tokenizedText.push(method(hackItem.name));
      break;
  }

  // params
  const params = hackItem.params;
  if (params != null) {
    tokenizedText.push(plain('('));
    let first = true;
    for (const param of params) {
      if (!first) {
        tokenizedText.push(plain(','));
        tokenizedText.push(whitespace(' '));
      }
      first = false;
      addModifiers(param.modifiers);
      tokenizedText.push(plain(param.name));
    }
    tokenizedText.push(plain(')'));
  }

  return {
    tokenizedText,
    representativeName: hackItem.name,
    startPosition: atomPointFromHack(
      hackItem.position.line,
      hackItem.position.char_start,
    ),
    endPosition: atomPointFromHack(
      hackItem.span.line_end,
      hackItem.span.char_end,
    ),
    children: hackItem.children == null
      ? []
      : hackItem.children.map(outlineFromHackIdeItem),
  };
}
