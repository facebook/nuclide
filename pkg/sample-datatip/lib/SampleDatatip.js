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

import type {Datatip} from 'atom-ide-ui';

import {wordAtPosition} from 'nuclide-commons-atom/range';
import {makeSampleDatatipComponent} from './SampleDatatipComponent';

const WORD_REGEX = /\w+/gi;

export async function datatip(
  editor: TextEditor,
  position: atom$Point,
): Promise<?Datatip> {
  const extractedWord = wordAtPosition(editor, position, WORD_REGEX);
  if (extractedWord == null) {
    return null;
  }
  const {wordMatch, range} = extractedWord;
  const word = wordMatch[0] == null ? 'N/A' : wordMatch[0];
  if (editor.getGrammar().scopeName === 'source.gfm') {
    // Demo of the Markdown string-based API.
    return {
      markedStrings: [
        {
          type: 'markdown',
          value: `An h1 header
============

Paragraphs are separated by a blank line.

2nd paragraph. *Italic*, **bold**, and \`monospace\`. Itemized lists
look like:

  * this one
  * that one
  * the other one`,
        },
        {
          type: 'snippet',
          grammar: atom.grammars.selectGrammar('js', ''),
          value: 'function f(x: number): boolean {',
        },
        {
          type: 'snippet',
          grammar: atom.grammars.selectGrammar('js', ''),
          value: 'function f: (number) => boolean',
        },
      ],
      range,
    };
  }
  return {
    // For more complex use cases, provide a custom React component.
    component: makeSampleDatatipComponent(word),
    range,
  };
}
