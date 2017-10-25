/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {DefinitionQueryResult} from './types';
import {wordAtPosition} from 'nuclide-commons-atom/range';
import {isPositionInRange} from 'nuclide-commons/range';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

// An atom$Range-aware, single-item cache for the common case of requerying
// a definition (such as previewing hyperclick and then jumping to the
// destination). It invalidates whenever the originating editor changes.
class DefinitionCache {
  _cachedResultEditor: ?atom$TextEditor;
  _cachedResultPromise: ?Promise<?DefinitionQueryResult>;
  _cachedResultRange: ?atom$Range;
  _disposables: UniversalDisposable = new UniversalDisposable();

  dispose() {
    this._disposables.dispose();
  }

  async get(
    editor: atom$TextEditor,
    position: atom$Point,
    getImpl: () => Promise<?DefinitionQueryResult>,
  ): Promise<?DefinitionQueryResult> {
    // queryRange is often a list of one range
    if (
      this._cachedResultRange != null &&
      this._cachedResultEditor === editor &&
      isPositionInRange(position, this._cachedResultRange)
    ) {
      return this._cachedResultPromise;
    }

    // invalidate whenever the buffer changes
    const invalidateAndStopListening = () => {
      this._cachedResultEditor = null;
      this._cachedResultRange = null;
      this._cachedResultRange = null;
      this._disposables.remove(editorDisposables);
      editorDisposables.dispose();
    };
    const editorDisposables = new UniversalDisposable(
      editor.getBuffer().onDidChangeText(invalidateAndStopListening),
      editor.onDidDestroy(invalidateAndStopListening),
    );
    this._disposables.add(editorDisposables);

    const wordGuess = wordAtPosition(editor, position);
    this._cachedResultRange = wordGuess && wordGuess.range;
    this._cachedResultPromise = getImpl();

    return this._cachedResultPromise;
  }
}

export default DefinitionCache;
