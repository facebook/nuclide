/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import {Range} from 'atom';
import invariant from 'assert';
import {wordAtPositionFromBuffer} from 'nuclide-commons/range';

/**
 * Finds the word at the position. You can either provide a word regex yourself,
 * or have Atom use the word regex in force at the scopes at that position,
 * in which case it uses the optional includeNonWordCharacters, default true.
 * (I know that's a weird default but it follows Atom's convention...)
 */
export function wordAtPosition(
  editor: atom$TextEditor,
  position: atom$PointObject,
  wordRegex?: RegExp | {includeNonWordCharacters: boolean},
): ?{wordMatch: Array<string>, range: atom$Range} {
  let wordRegex_;
  if (wordRegex instanceof RegExp) {
    wordRegex_ = wordRegex;
  } else {
    // What is the word regex associated with the position? We'd like to use
    // atom$Cursor.wordRegExp, except that function gets the regex associated
    // with the editor's current cursor while we want the regex associated with
    // the specific position. So we re-implement it ourselves...
    const nonWordChars = editor.getNonWordCharacters(position);
    const escaped = nonWordChars.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    // We copied this escaping regex from atom$Cursor.wordRegexp, rather than
    // using the library function 'escapeStringRegExp'. That's because the
    // library function doesn't escape the hyphen character and so is
    // unsuitable for use inside a range.
    let r = `^[\t ]*$|[^\\s${escaped}]+`;
    if (wordRegex == null || wordRegex.includeNonWordCharacters) {
      r += `|[${escaped}]+`;
    }
    wordRegex_ = new RegExp(r, 'g');
  }
  return wordAtPositionFromBuffer(editor.getBuffer(), position, wordRegex_);
}

/**
 * Gets the trimmed range from a given range, i.e. moves the start and end points
 * to the first and last non-whitespace characters (or specified regex)
 * within the range respectively.
 *
 * @param editor       the editor containing the range
 * @param rangeToTrim  the range to trim
 * @param stopRegex    stop trimming when the first match is found for this regex,
 *   defaults to first non-whitespace character
 * @return atom$Range  the trimmed range
 */
export function trimRange(
  editor: atom$TextEditor,
  rangeToTrim: atom$Range,
  stopRegex: RegExp = /\S/,
): atom$Range {
  const buffer = editor.getBuffer();
  let {start, end} = rangeToTrim;
  buffer.scanInRange(stopRegex, rangeToTrim, ({range, stop}) => {
    start = range.start;
    stop();
  });
  buffer.backwardsScanInRange(stopRegex, rangeToTrim, ({range, stop}) => {
    end = range.end;
    stop();
  });
  return new Range(start, end);
}

function getSingleWordAtPosition(
  editor: atom$TextEditor,
  position: atom$Point,
): ?string {
  const match = wordAtPosition(editor, position);
  // We should only receive a single identifier from a single point.
  if (match == null || match.wordMatch.length !== 1) {
    return null;
  }

  return match.wordMatch[0];
}

/**
 * Gets the word being right-clicked on in a MouseEvent. A good use case for
 * this is performing an action on a word from a context menu.
 *
 * @param editor  the editor containing the word where the MouseEvent occurred
 *   from
 * @param event   the MouseEvent containing the screen position of the click
 */
export function getWordFromMouseEvent(
  editor: atom$TextEditor,
  event: MouseEvent,
): ?string {
  // We can't immediately get the identifier right-clicked on from
  // the MouseEvent. Using its target element content would work in
  // some cases but wouldn't work if there was additional content
  // in the same element, such as in a comment.
  const component = editor.getElement().component;
  invariant(component);
  // This solution doesn't feel ideal but it is the way hyperclick does it.
  const point = component.screenPositionForMouseEvent(event);
  return getSingleWordAtPosition(editor, point);
}

/**
 * Attempts to get a word from the last selection or cursor. A good use case for
 * this is performing an action on an 'active' word after a command is triggered
 * via a keybinding.
 *
 * @param editor  the editor containing the 'active' word when the keybinding is
 *   triggered
 */
export function getWordFromCursorOrSelection(editor: atom$TextEditor): ?string {
  const selection = editor.getSelectedText();
  if (selection && selection.length > 0) {
    return selection;
  }

  // There was no selection so we can go ahead and try the cursor position.
  const point = editor.getCursorScreenPosition();
  return getSingleWordAtPosition(editor, point);
}
