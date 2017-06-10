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

import type {HyperclickSuggestion} from 'atom-ide-ui';

import {Range} from 'atom';
import {shell} from 'electron';
import {URL_REGEX} from 'nuclide-commons/string';

const TRAILING_JUNK_REGEX = /[.,]?$/;

// Exported for testing.
export function matchUrl(text: string): ?{url: string, index: number} {
  const match = URL_REGEX.exec(text);
  if (match == null) {
    return null;
  }
  URL_REGEX.lastIndex = 0;
  return {
    index: match.index,
    url: match[0].replace(TRAILING_JUNK_REGEX, ''),
  };
}

export default class HyperclickProviderHelpers {
  static async getSuggestionForWord(
    textEditor: atom$TextEditor,
    text: string,
    range: atom$Range,
  ): Promise<?HyperclickSuggestion> {
    // The match is an array that also has an index property, something that
    // Flow does not appear to understand.
    const match = matchUrl(text);
    if (match == null) {
      return null;
    }

    const {index, url} = match;
    const matchLength = url.length;

    // Update the range to include only what was matched
    const urlRange = new Range(
      [range.start.row, range.start.column + index],
      [range.end.row, range.start.column + index + matchLength],
    );

    return {
      range: urlRange,
      callback() {
        shell.openExternal(url);
      },
    };
  }
}
