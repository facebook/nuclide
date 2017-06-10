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
import type {DefinitionQueryResult} from 'atom-ide-ui';
import type JediServerManager from '../lib/JediServerManager';

import {Point} from 'simple-text-buffer';
import {wordAtPositionFromBuffer} from 'nuclide-commons/range';

const WORD_REGEXP = /[a-zA-Z_][a-zA-Z0-9_]*/g;

export async function getDefinition(
  serverManager: JediServerManager,
  filePath: NuclideUri,
  buffer: simpleTextBuffer$TextBuffer,
  position: atom$Point,
): Promise<?DefinitionQueryResult> {
  const wordMatch = wordAtPositionFromBuffer(buffer, position, WORD_REGEXP);
  if (wordMatch == null) {
    return null;
  }

  const {range} = wordMatch;

  const line = position.row;
  const column = position.column;
  const contents = buffer.getText();

  const service = await serverManager.getJediService(filePath);
  const result = await service.get_definitions(
    filePath,
    contents,
    line,
    column,
  );
  if (result == null || result.length === 0) {
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
