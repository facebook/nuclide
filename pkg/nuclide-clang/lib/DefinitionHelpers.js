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

import type {Definition, DefinitionQueryResult} from 'atom-ide-ui';

import {getDeclaration} from './libclang';
import findWholeRangeOfSymbol from './findWholeRangeOfSymbol';
import invariant from 'assert';
import {wordAtPosition} from 'nuclide-commons-atom/range';
import {trackTiming} from '../../nuclide-analytics';
import {GRAMMAR_SET, IDENTIFIER_REGEXP} from './constants';

export default class DefinitionHelpers {
  static getDefinition(
    editor: TextEditor,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    return trackTiming('clang.get-definition', () =>
      DefinitionHelpers._getDefinition(editor, position),
    );
  }

  static async _getDefinition(
    editor: TextEditor,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    invariant(GRAMMAR_SET.has(editor.getGrammar().scopeName));

    const src = editor.getPath();
    if (src == null) {
      return null;
    }

    const contents = editor.getText();

    const wordMatch = wordAtPosition(editor, position, IDENTIFIER_REGEXP);
    if (wordMatch == null) {
      return null;
    }

    const {range} = wordMatch;

    const result = await getDeclaration(editor, position.row, position.column);
    if (result == null) {
      return null;
    }

    const wholeRange = findWholeRangeOfSymbol(
      editor,
      contents,
      range,
      result.spelling,
      result.extent,
    );
    const definition: Definition = {
      path: result.file,
      position: result.point,
      range: result.extent,
      language: 'clang',
      // TODO: projectRoot
    };

    if (result.spelling != null) {
      definition.name = result.spelling;
    }

    return {
      queryRange: wholeRange,
      definitions: [definition],
    };
  }
}
