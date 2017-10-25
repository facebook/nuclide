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

import type {Observable} from 'rxjs';

import {Subject} from 'rxjs';
import invariant from 'assert';
import idx from 'idx';

type Options = {|
  line?: number,
  column?: number,
  center?: boolean,
  activateItem?: boolean,
  activatePane?: boolean,
  pending?: boolean,
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
 * // eslint-disable-next-line rulesdir/atom-apis
 */
export async function goToLocation(
  file: string,
  options?: ?Options,
): Promise<atom$TextEditor> {
  const center_ = idx(options, _ => _.center);
  const center = center_ == null ? true : center_;
  const activatePane_ = idx(options, _ => _.activatePane);
  const activatePane = activatePane_ == null ? true : activatePane_;
  const activateItem = idx(options, _ => _.activateItem);
  const line = idx(options, _ => _.line);
  const column = idx(options, _ => _.column);
  const pending = idx(options, _ => _.pending);

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
      });
    } else {
      invariant(column == null, 'goToLocation: Cannot specify just column');
    }
    return currentEditor;
  } else {
    // Obviously, calling goToLocation isn't a viable alternative here :P
    // eslint-disable-next-line rulesdir/atom-apis
    const editor = await atom.workspace.open(file, {
      initialLine: line,
      initialColumn: column,
      searchAllPanes: true,
      activatePane,
      activateItem,
      pending,
    });

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
|};

// Scrolls to the given line/column at the given editor
// broadcasts the editor instance on an observable (subject) available
// through the getGoToLocation
export function goToLocationInEditor(
  editor: atom$TextEditor,
  options: GotoLocationInEditorOptions,
): void {
  const center = options.center == null ? true : options.center;
  const {line, column} = options;

  editor.setCursorBufferPosition([line, column]);
  if (center) {
    editor.scrollToBufferPosition([line, column], {center: true});
  }

  goToLocationSubject.next(editor);
}

export function observeNavigatingEditors(): Observable<atom$TextEditor> {
  return goToLocationSubject;
}
