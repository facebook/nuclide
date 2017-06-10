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

import type {Datatip} from '../../nuclide-datatip/lib/types';

import {wordAtPosition} from 'nuclide-commons-atom/range';
import makeUnescapedUnicodeDatatipComponent
  from './UnescapedUnicodeDatatipComponent';
import {decodeSurrogateCodePoints, extractCodePoints} from './Unicode';

// Our "word" for the datatip is a contiguous alphanumeric string
// containing at least one Unicode escape: \uXXXX, \UXXXXXXXX, or
// \u{XXXX}.
//
// eslint-disable-next-line max-len
const WORD_REGEX = /[a-zA-Z0-9_-]*(?:\\u[0-9a-fA-F]{4}|\\U[0-9a-fA-F]{8}|\\u{[0-9a-fA-F]{1,8}})+(?:\\u[0-9a-fA-F]{4}|\\U[0-9a-fA-F]{8}|\\u{[0-9a-fA-F]{1,8}}|[a-zA-Z0-9_-])*/g;

export default (async function unescapedUnicodeDatatip(
  editor: TextEditor,
  position: atom$Point,
): Promise<?Datatip> {
  const extractedWord = wordAtPosition(editor, position, WORD_REGEX);
  if (extractedWord == null) {
    return null;
  }
  const extractedCodePoints = extractCodePoints(extractedWord.wordMatch[0]);
  const codePoints = decodeSurrogateCodePoints(extractedCodePoints);
  return {
    component: makeUnescapedUnicodeDatatipComponent(codePoints),
    range: extractedWord.range,
  };
});
