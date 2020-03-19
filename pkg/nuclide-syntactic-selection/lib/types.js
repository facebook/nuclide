/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

export type SyntacticSelectionProvider = {
  grammarScopes: Array<string>,
  priority: number,

  getExpandedSelectionRange(editor: atom$TextEditor): Promise<?atom$Range>,

  getCollapsedSelectionRange(
    editor: atom$TextEditor,
    originalCursorPosition: atom$Point,
  ): Promise<?atom$Range>,
};
