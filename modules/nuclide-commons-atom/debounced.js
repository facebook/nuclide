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

/**
 * Often, we may want to respond to Atom events, but only after a buffer period
 * of no change.
 * For example, Atom provides Workspace::onDidChangeActivePaneItem, but we may
 * want to know not when the active pane item has changed, buth when it has
 * stopped changing.
 * This file provides methods to do this.
 */

import {Observable} from 'rxjs';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {getCursorPositions, isValidTextEditor} from './text-editor';
import invariant from 'assert';

const DEFAULT_PANE_DEBOUNCE_INTERVAL_MS = 100;
const DEFAULT_EDITOR_DEBOUNCE_INTERVAL_MS = 300;
const DEFAULT_POSITION_DEBOUNCE_INTERVAL_MS = 300;

export function observeActivePaneItemDebounced(
  debounceInterval: number = DEFAULT_PANE_DEBOUNCE_INTERVAL_MS,
): Observable<mixed> {
  return observableFromSubscribeFunction(callback => {
    if (atom.workspace.getCenter != null) {
      return atom.workspace.getCenter().observeActivePaneItem(callback);
    }
    return atom.workspace.observeActivePaneItem(callback);
  }).debounceTime(debounceInterval);
}

export function observeActiveEditorsDebounced(
  debounceInterval: number = DEFAULT_PANE_DEBOUNCE_INTERVAL_MS,
): Observable<?atom$TextEditor> {
  return observeActivePaneItemDebounced(debounceInterval).map(paneItem => {
    if (isValidTextEditor(paneItem)) {
      // Flow cannot understand the type refinement provided by the isValidTextEditor function,
      // so we have to cast.
      return ((paneItem: any): atom$TextEditor);
    }
    return null;
  });
}

export function editorChangesDebounced(
  editor: atom$TextEditor,
  debounceInterval: number = DEFAULT_EDITOR_DEBOUNCE_INTERVAL_MS,
): Observable<void> {
  return (
    observableFromSubscribeFunction(callback => editor.onDidChange(callback))
      // Debounce manually rather than using editor.onDidStopChanging so that the debounce time is
      // configurable.
      .debounceTime(debounceInterval)
  );
}

export function editorScrollTopDebounced(
  editor: atom$TextEditor,
  debounceInterval: number = DEFAULT_EDITOR_DEBOUNCE_INTERVAL_MS,
): Observable<number> {
  return observableFromSubscribeFunction(callback =>
    atom.views.getView(editor).onDidChangeScrollTop(callback),
  ).debounceTime(debounceInterval);
}

export type EditorPosition = {
  editor: atom$TextEditor,
  position: atom$Point,
};

// Yields null when the current pane is not an editor,
// otherwise yields events on each move of the primary cursor within any Editor.
export function observeTextEditorsPositions(
  editorDebounceInterval: number = DEFAULT_EDITOR_DEBOUNCE_INTERVAL_MS,
  positionDebounceInterval: number = DEFAULT_POSITION_DEBOUNCE_INTERVAL_MS,
): Observable<?EditorPosition> {
  return observeActiveEditorsDebounced(
    editorDebounceInterval,
  ).switchMap(editor => {
    return editor == null
      ? Observable.of(null)
      : getCursorPositions(editor)
          .debounceTime(positionDebounceInterval)
          .map(position => {
            invariant(editor != null);
            return {editor, position};
          });
  });
}
