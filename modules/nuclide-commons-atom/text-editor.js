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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import invariant from 'assert';
import {Observable} from 'rxjs';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import nuclideUri from 'nuclide-commons/nuclideUri';

/**
 * Returns a text editor that has the given path open, or null if none exists. If there are multiple
 * text editors for this path, one is chosen arbitrarily.
 */
export function existingEditorForUri(path: NuclideUri): ?atom$TextEditor {
  // This isn't ideal but realistically iterating through even a few hundred editors shouldn't be a
  // real problem. And if you have more than a few hundred you probably have bigger problems.
  for (const editor of atom.workspace.getTextEditors()) {
    if (editor.getPath() === path) {
      return editor;
    }
  }

  return null;
}

/**
 * Returns a text editor that has the given buffer open, or null if none exists. If there are
 * multiple text editors for this buffer, one is chosen arbitrarily.
 */
export function existingEditorForBuffer(
  buffer: atom$TextBuffer,
): ?atom$TextEditor {
  // This isn't ideal but realistically iterating through even a few hundred editors shouldn't be a
  // real problem. And if you have more than a few hundred you probably have bigger problems.
  for (const editor of atom.workspace.getTextEditors()) {
    if (editor.getBuffer() === buffer) {
      return editor;
    }
  }

  return null;
}

export function getViewOfEditor(
  editor: atom$TextEditor,
): atom$TextEditorElement {
  return atom.views.getView(editor);
}

export function getScrollTop(editor: atom$TextEditor): number {
  return getViewOfEditor(editor).getScrollTop();
}

export function setScrollTop(editor: atom$TextEditor, scrollTop: number): void {
  getViewOfEditor(editor).setScrollTop(scrollTop);
}

/**
 * Does a best effort to set an editor pane to a given cursor position & scroll.
 * Does not ensure that the current cursor position is visible.
 *
 * Can be used with editor.getCursorBufferPosition() & getScrollTop() to restore
 * an editors cursor and scroll.
 */
export function setPositionAndScroll(
  editor: atom$TextEditor,
  position: atom$Point,
  scrollTop: number,
): void {
  editor.setCursorBufferPosition(position, {autoscroll: false});
  setScrollTop(editor, scrollTop);
}

export function getCursorPositions(
  editor: atom$TextEditor,
): Observable<atom$Point> {
  // This will behave strangely in the face of multiple cursors. Consider supporting multiple
  // cursors in the future.
  const cursor = editor.getCursors()[0];
  invariant(cursor != null);
  return Observable.merge(
    Observable.of(cursor.getBufferPosition()),
    observableFromSubscribeFunction(
      cursor.onDidChangePosition.bind(cursor),
    ).map(event => event.newBufferPosition),
  );
}

export function observeEditorDestroy(
  editor: atom$TextEditor,
): Observable<atom$TextEditor> {
  return observableFromSubscribeFunction(editor.onDidDestroy.bind(editor))
    .map(event => editor)
    .take(1);
}

// As of the introduction of atom.workspace.buildTextEditor(), it is no longer possible to
// subclass TextEditor to create a ReadOnlyTextEditor. Instead, the way to achieve this effect
// is to create an ordinary TextEditor and then override any methods that would allow it to
// change its contents.
// TODO: https://github.com/atom/atom/issues/9237.
export function enforceReadOnly(textEditor: atom$TextEditor): void {
  const noop = () => {};

  // Cancel insert events to prevent typing in the text editor and disallow editing (read-only).
  textEditor.onWillInsertText(event => {
    event.cancel();
  });

  const textBuffer = textEditor.getBuffer();

  // All user edits use `transact` - so, mocking this will effectively make the editor read-only.
  const originalApplyChange = textBuffer.applyChange;
  textBuffer.applyChange = noop;

  // `setText` & `append` are the only exceptions that's used to set the read-only text.
  passReadOnlyException('append');
  passReadOnlyException('setText');

  function passReadOnlyException(functionName: string) {
    const buffer: any = textBuffer;
    const originalFunction = buffer[functionName];

    buffer[functionName] = function() {
      textBuffer.applyChange = originalApplyChange;
      const result = originalFunction.apply(textBuffer, arguments);
      textBuffer.applyChange = noop;
      return result;
    };
  }
}

// Turn off soft wrap setting for these editors so diffs properly align.
// Some text editor register sometimes override the set soft wrapping
// after mounting an editor to the workspace - here, that's watched and reset to `false`.
export function enforceSoftWrap(
  editor: atom$TextEditor,
  enforcedSoftWrap: boolean,
): IDisposable {
  editor.setSoftWrapped(enforcedSoftWrap);
  return editor.onDidChangeSoftWrapped(softWrapped => {
    if (softWrapped !== enforcedSoftWrap) {
      // Reset the overridden softWrap to `false` once the operation completes.
      process.nextTick(() => {
        if (!editor.isDestroyed()) {
          editor.setSoftWrapped(enforcedSoftWrap);
        }
      });
    }
  });
}

/**
 * Small wrapper around `atom.workspace.observeTextEditors` that filters out
 * uninitialized remote editors. Most callers should use this one instead.
 */
export function observeTextEditors(
  callback: (editor: atom$TextEditor) => mixed,
): IDisposable {
  // The one place where atom.workspace.observeTextEditors needs to be used.
  // eslint-disable-next-line nuclide-internal/atom-apis
  return atom.workspace.observeTextEditors(editor => {
    if (isValidTextEditor(editor)) {
      callback(editor);
    }
  });
}

/**
 * Checks if an object (typically an Atom pane) is a TextEditor with a non-broken path.
 */
export function isValidTextEditor(item: mixed): boolean {
  // eslint-disable-next-line nuclide-internal/atom-apis
  if (atom.workspace.isTextEditor(item)) {
    return !nuclideUri.isBrokenDeserializedUri(
      ((item: any): atom$TextEditor).getPath(),
    );
  }
  return false;
}

export function centerScrollToBufferLine(
  textEditorElement: atom$TextEditorElement,
  bufferLineNumber: number,
): void {
  const textEditor = textEditorElement.getModel();
  const pixelPositionTop = textEditorElement.pixelPositionForBufferPosition([
    bufferLineNumber,
    0,
  ]).top;
  // Manually calculate the scroll location, instead of using
  // `textEditor.scrollToBufferPosition([lineNumber, 0], {center: true})`
  // because that API to wouldn't center the line if it was in the visible screen range.
  const scrollTop =
    pixelPositionTop +
    textEditor.getLineHeightInPixels() / 2 -
    textEditorElement.clientHeight / 2;
  textEditorElement.setScrollTop(Math.max(scrollTop, 1));

  textEditorElement.focus();

  textEditor.setCursorBufferPosition([bufferLineNumber, 0], {
    autoscroll: false,
  });
}
