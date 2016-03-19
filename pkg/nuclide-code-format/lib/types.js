'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

export type CodeFormatProvider = {
  /**
   * Providers should implement at least one of formatCode / formatEntireFile.
   * If formatCode exists, it'll be used if the editor selection isn't empty, or
   * if it's empty but formatEntireFile doesn't exist.
   */

  /**
   * Formats the range specified, and returns the replacement result for that range.
   */
  formatCode?: (editor: atom$TextEditor, range: atom$Range) => Promise<string>;

  /**
   * Formats the range specified, but returns the entire file (along with the new cursor position).
   * Useful for less-flexible providers like clang-format.
   */
  formatEntireFile?: (editor: atom$TextEditor, range: atom$Range) => Promise<{
    newCursor: number;
    formatted: string;
  }>;

  selector: string;
  inclusionPriority: number;
};
