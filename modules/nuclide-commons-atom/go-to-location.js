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

import type {Observable} from 'rxjs';

import {getLogger} from 'log4js';
import {Subject} from 'rxjs';
import invariant from 'assert';

export type GoToLocationOptions = {|
  line?: number,
  column?: number,
  center?: boolean,
  activateItem?: boolean,
  activatePane?: boolean,
  pending?: boolean,
  moveCursor?: boolean,
|};

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
  options?: ?GoToLocationOptions,
): Promise<atom$TextEditor> {
  const center = options?.center ?? true;
  const moveCursor = options?.moveCursor ?? true;
  const activatePane = options?.activatePane ?? true;
  const activateItem = options?.activateItem;
  const line = options?.line;
  const column = options?.column;
  const pending = options?.pending;

  // Prefer going to the current editor rather than the leftmost editor.
  const currentEditor = atom.workspace.getActiveTextEditor();
  if (currentEditor != null && currentEditor.getPath() === file) {
    const paneContainer = atom.workspace.paneContainerForItem(currentEditor);
    invariant(paneContainer != null);
    if (activatePane) {
      paneContainer.activate();
    }
    if (line != null) {
      goToLocationInEditor(currentEditor, {
        line,
        column: column == null ? 0 : column,
        center,
        moveCursor,
      });
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
      activatePane,
      activateItem,
      pending,
    });
    // TODO(T28305560) Investigate offenders for this error
    if (editor == null) {
      const tmp = {};
      Error.captureStackTrace(tmp);
      const error = Error(`atom.workspace.open returned null on ${file}`);
      getLogger('goToLocation').error(error);
      throw error;
    }

    if (center && line != null) {
      editor.scrollToBufferPosition([line, column], {center: true});
    }
    return editor;
  }
}

const goToLocationSubject = new Subject();

type GotoLocationInEditorOptions = {|
  line: number,
  column: number,
  center?: boolean,
  moveCursor?: boolean,
|};

// Scrolls to the given line/column at the given editor
// broadcasts the editor instance on an observable (subject) available
// through the getGoToLocation
export function goToLocationInEditor(
  editor: atom$TextEditor,
  options: GotoLocationInEditorOptions,
): void {
  const center = options.center == null ? true : options.center;
  const moveCursor = options.moveCursor == null ? true : options.moveCursor;
  const {line, column} = options;

  if (moveCursor) {
    editor.setCursorBufferPosition([line, column]);
  }
  if (center) {
    editor.scrollToBufferPosition([line, column], {center: true});
  }

  goToLocationSubject.next(editor);
}

export function observeNavigatingEditors(): Observable<atom$TextEditor> {
  return goToLocationSubject;
}
