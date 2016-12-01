'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {HyperclickSuggestion} from '../../hyperclick/lib/types';

import {Range} from 'atom';
import {shell} from 'electron';
import urlregexp from 'urlregexp';

// urlregexp will match trailing: ' | " | '. | ', | ". | ",
// These are most likely not part of the url, but just junk that got caught.
const trailingJunkRe = /['"][.,]?$/;

export default class HyperclickProviderHelpers {
  static async getSuggestionForWord(
    textEditor: atom$TextEditor,
    text: string,
    range: atom$Range,
  ): Promise<?HyperclickSuggestion> {
    // The match is an array that also has an index property, something that
    // Flow does not appear to understand.
    const match: any = urlregexp.exec(text);
    if (match == null) {
      return null;
    }

    urlregexp.lastIndex = 0;

    const url = match[0].replace(trailingJunkRe, '');
    const index = match.index;
    const matchLength = url.length;

    // Update the range to include only what was matched
    const urlRange = new Range(
      [range.start.row, range.start.column + index],
      [range.end.row, range.start.column + index + matchLength],
    );

    return {
      range: urlRange,
      callback() {
        let validUrl;
        if (url.startsWith('http://') || url.startsWith('https://')) {
          validUrl = url;
        } else {
          // Now that we match urls like 'facebook.com', we have to prepend
          // http:// to them for them to open properly.
          validUrl = 'http://' + url;
        }
        shell.openExternal(validUrl);
      },
    };
  }
}
