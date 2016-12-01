'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {NuclideUri} from '../../commons-node/nuclideUri';
import type {
  Definition,
  DefinitionQueryResult,
} from '../../nuclide-definition-service/lib/rpc-types';
import typeof * as PythonService from '../../nuclide-python-rpc';

import invariant from 'assert';
import {Point} from 'atom';
import {wordAtPosition} from '../../commons-atom/range';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';
import {trackTiming} from '../../nuclide-analytics';
import {GRAMMAR_SET} from './constants';

export default class DefinitionHelpers {

  static getDefinition(
    editor: TextEditor,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    return trackTiming(
      'python.get-definition',
      () => DefinitionHelpers._getDefinition(editor, position),
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

    const line = position.row;
    const column = position.column;
    const contents = editor.getText();

    const wordMatch = wordAtPosition(editor, position);
    if (wordMatch == null) {
      return null;
    }

    const {range} = wordMatch;

    const service: ?PythonService = getServiceByNuclideUri('PythonService', src);
    if (service == null) {
      return null;
    }

    const result = await service.getDefinitions(
      src,
      contents,
      line,
      column,
    );
    if (result == null) {
      return null;
    }

    if (result.length === 0) {
      return null;
    }

    const definitions = result.map(definition => ({
      path: definition.file,
      position: new Point(definition.line, definition.column),
      id: definition.text,
      name: definition.text,
      language: 'python',
    }));

    return {
      queryRange: [range],
      definitions,
    };
  }

  static getDefinitionById(
    filePath: NuclideUri,
    id: string,
  ): Promise<?Definition> {
    return trackTiming('python.get-definition-by-id', async () => {
      // TODO:
      return null;
    });
  }
}
