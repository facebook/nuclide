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

import type {Outline, OutlineTree} from 'atom-ide-ui';
import type {ClangOutlineTree} from '../../nuclide-clang-rpc/lib/rpc-types';
import type {TokenizedText} from 'nuclide-commons/tokenized-text';

import {trackTiming} from '../../nuclide-analytics';
import {sleep} from 'nuclide-commons/promise';
import {ClangCursorTypes} from '../../nuclide-clang-rpc';
import {
  keyword,
  className,
  method,
  param,
  whitespace,
  string,
  plain,
} from 'nuclide-commons/tokenized-text';
import {getOutline} from './libclang';

// Display friendly names for all class-like types.
const CLASS_KIND_NAMES = {
  [ClangCursorTypes.STRUCT_DECL]: 'struct',
  [ClangCursorTypes.UNION_DECL]: 'union',
  [ClangCursorTypes.CLASS_DECL]: 'class',
  [ClangCursorTypes.ENUM_DECL]: 'enum',
  [ClangCursorTypes.OBJC_INTERFACE_DECL]: '@interface',
  [ClangCursorTypes.OBJC_CATEGORY_DECL]: '@interface',
  [ClangCursorTypes.OBJC_PROTOCOL_DECL]: '@protocol',
  [ClangCursorTypes.OBJC_IMPLEMENTATION_DECL]: '@implementation',
  [ClangCursorTypes.OBJC_CATEGORY_IMPL_DECL]: '@implementation',
  [ClangCursorTypes.CLASS_TEMPLATE]: 'class',
  [ClangCursorTypes.CLASS_TEMPLATE_PARTIAL_SPECIALIZATION]: 'class',
  [ClangCursorTypes.NAMESPACE]: 'namespace',
};

// Collapse template arguments for long types.
const LONG_TYPE_LENGTH = 50;

// TODO(hansonw): Highlight tokens inside types.
function tokenizeType(type: string): TokenizedText {
  if (type.length > LONG_TYPE_LENGTH) {
    const openIndex = type.indexOf('<');
    if (openIndex !== -1) {
      const closeIndex = type.lastIndexOf('>');
      if (closeIndex !== -1) {
        return [
          plain(type.substring(0, openIndex + 1)),
          string('...'),
          plain(type.substring(closeIndex)),
        ];
      }
    }
  }
  return [plain(type)];
}

function tokenizeCursor(cursor: ClangOutlineTree): TokenizedText {
  if (cursor.children != null) {
    return [
      keyword(CLASS_KIND_NAMES[cursor.cursor_kind] || 'class'),
      whitespace(' '),
      className(cursor.name),
    ];
  }
  if (cursor.params != null) {
    const {params, tparams} = cursor;
    const paramTokens = [];
    params.forEach(fparam => {
      if (paramTokens.length > 0) {
        paramTokens.push(plain(', '));
      }
      paramTokens.push(param(fparam));
    });
    const tparamTokens = [];
    if (tparams != null && tparams.length > 0) {
      tparamTokens.push(plain('<'));
      tparams.forEach(tparam => {
        if (tparamTokens.length > 1) {
          tparamTokens.push(plain(', '));
        }
        tparamTokens.push(plain(tparam));
      });
      tparamTokens.push(plain('>'));
    }
    return [
      method(cursor.name),
      ...tparamTokens,
      plain('('),
      ...paramTokens,
      plain(')'),
    ];
  }
  if (cursor.cursor_type != null) {
    return [
      ...tokenizeType(cursor.cursor_type),
      whitespace(' '),
      className(cursor.name),
    ];
  }
  return [plain(cursor.name)];
}

export function outlineFromClangOutline(
  outline: Array<ClangOutlineTree>,
): Array<OutlineTree> {
  return outline.map(cursor => {
    return {
      tokenizedText: tokenizeCursor(cursor),
      representativeName: cursor.name,
      startPosition: cursor.extent.start,
      endPosition: cursor.extent.end,
      children: cursor.children ? outlineFromClangOutline(cursor.children) : [],
    };
  });
}

export default class OutlineViewHelpers {
  static getOutline(editor: atom$TextEditor): Promise<?Outline> {
    return trackTiming('nuclide-clang-atom:outline-view', async () => {
      // HACK: Since outline view and diagnostics both trigger on save, favor diagnostics.
      await sleep(0);
      const clangOutline = await getOutline(editor);
      if (clangOutline == null) {
        return null;
      }
      return {
        outlineTrees: outlineFromClangOutline(clangOutline),
      };
    });
  }
}
