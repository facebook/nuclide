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

export type HyperclickProvider = {
  // Use this to provide a suggestion for single-word matches.
  // Optionally set `wordRegExp` to adjust word-matching.
  getSuggestionForWord?: (
    textEditor: atom$TextEditor,
    text: string,
    range: atom$Range,
  ) => Promise<?HyperclickSuggestion>,

  wordRegExp?: RegExp,

  // Use this to provide a suggestion if it can have non-contiguous ranges.
  // A primary use-case for this is Objective-C methods.
  getSuggestion?: (
    textEditor: atom$TextEditor,
    position: atom$Point,
  ) => Promise<?HyperclickSuggestion>,

  // Must be unique. Used for analytics.
  providerName?: string,

  // The higher this is, the more precedence the provider gets.
  priority: number,

  // Optionally, limit the set of grammar scopes the provider should apply to.
  grammarScopes?: Array<string>,
};

export type HyperclickSuggestion = {
  // The range(s) to underline to provide as a visual cue for clicking.
  range: ?atom$Range | ?Array<atom$Range>,

  // The function to call when the underlined text is clicked.
  callback:
    | (() => mixed)
    | Array<{rightLabel?: string, title: string, callback: () => mixed}>,
};
