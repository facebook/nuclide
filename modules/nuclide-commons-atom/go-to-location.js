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

import {Subject} from 'rxjs';
import type {Observable} from 'rxjs';
import invariant from 'assert';

/**
 * Opens the given file.
 *
 * Optionally include a line and column to navigate to. If a line is given, by default it will
 * center it in the opened text editor.
 *
 * This should be preferred over `atom.workspace.open()` in typical cases. The motivations are:
 * - We call `atom.workspace.open()` with the `searchAllPanes` option. This looks in other panes for
 *   the current file, rather just opening a new copy in the current pane. People often forget this
 *   option which typically leads to a subpar experience for people who use multiple panes.
 * - When moving around in the current file, `goToLocation` explicitly publishes events that the nav
 *   stack uses.
 *
 * Currently, `atom.workspace.open()` should be used only in these cases:
 * - When the URI to open is not a file URI. For example, if we want to open some tool like find
 *   references in a pane.
 * - When we want to open an untitled file (providing no file argument). Currently, goToLocation
 *   requires a file to open.
 * - When we want to open a file as a pending pane item. Currently goToLocation cannot do this.
 *
 * In these cases, you may disable the lint rule against `atom.workspace.open` by adding the
 * following comment above its use:
 * // eslint-disable-next-line nuclide-internal/atom-apis
 */
export async function goToLocation(
  file: string,
  line?: number,
  column?: number,
  center?: boolean = true,
): Promise<atom$TextEditor> {
  // Prefer going to the current editor rather than the leftmost editor.
  const currentEditor = atom.workspace.getActiveTextEditor();
  if (currentEditor != null && currentEditor.getPath() === file) {
    if (line != null) {
      goToLocationInEditor(
        currentEditor,
        line,
        column == null ? 0 : column,
        center,
      );
    } else {
      invariant(column == null, 'goToLocation: Cannot specify just column');
    }
    return currentEditor;
  } else {
    // Obviously, calling goToLocation isn't a viable alternative here :P
    // eslint-disable-next-line nuclide-internal/atom-apis
    const editor = await atom.workspace.open(file, {
      initialLine: line,
      initialColumn: column,
      searchAllPanes: true,
    });

    if (center && line != null) {
      editor.scrollToBufferPosition([line, column], {center: true});
    }
    return editor;
  }
}

const goToLocationSubject = new Subject();

// Scrolls to the given line/column at the given editor
// broadcasts the editor instance on an observable (subject) available
// through the getGoToLocation
export function goToLocationInEditor(
  editor: atom$TextEditor,
  line: number,
  column: number,
  center: boolean = true,
): void {
  editor.setCursorBufferPosition([line, column]);
  if (center) {
    editor.scrollToBufferPosition([line, column], {center: true});
  }

  goToLocationSubject.next(editor);
}

export function observeNavigatingEditors(): Observable<atom$TextEditor> {
  return goToLocationSubject;
}
