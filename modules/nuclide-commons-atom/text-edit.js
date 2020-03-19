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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import invariant from 'assert';
import {getLogger} from 'log4js';

import {existingEditorForUri} from './text-editor';
import {goToLocation} from './go-to-location';

export type TextEdit = {
  oldRange: atom$Range,
  newText: string,
  // If included, this will be used to verify that the edit still applies cleanly.
  oldText?: string,
};

/**
 * Attempts to apply the given patches for multiple files. Accepts a Map as input
 * with file paths as keys and a corresponding array of TextEdits as values.
 *
 * It is an error to send overlapping text-edits. All text-edits describe changes
 * made to the initial document version. The order of the edits does not matter
 * as they will be sorted before they are applied.
 *
 * All changes will be applied to the buffers but not saved. If a file is not
 * currently open, it will be opened.
 *
 * If a change is undone (Cmd+Z), only the changes of the current
 * file will be undone. All of the changes for that file will be undone at once.
 *
 * Returns true if the application was successful, otherwise false. If any of
 * the changes fail, for ANY file, then none of the changes are applied.
 */
export async function applyTextEditsForMultipleFiles(
  changes: Map<NuclideUri, Array<TextEdit>>,
): Promise<boolean> {
  const paths = Array.from(changes.keys());

  // NOTE: There is a race here. If the file contents change while the
  // editors are being opened, then the ranges of the TextEdits will be off.
  // However, currently this is only used to applyEdits to open files.
  const editors = await Promise.all(
    paths.map(async path => goToLocation(path)),
  );
  const checkpoints = editors.map(editor => {
    invariant(editor != null);
    const buffer = editor.getBuffer();
    return [buffer, buffer.createCheckpoint()];
  });
  const allOkay = paths.reduce((successSoFar, path) => {
    const edits = changes.get(path);
    return successSoFar && edits != null && applyTextEdits(path, ...edits);
  }, true);
  if (!allOkay) {
    checkpoints.forEach(([buffer, checkPoint]) => {
      buffer.revertToCheckpoint(checkPoint);
      return false;
    });
  }
  return allOkay;
}

/**
 * Attempts to apply the given patches to the given file.
 *
 * It is an error to send overlapping edits. The order of the edits does not
 * matter (they will be sorted before they are applied).
 *
 * The file must be currently open in Atom, and the changes will be applied to the buffer but not
 * saved.
 *
 * Returns true if the application was successful, otherwise false (e.g. if the oldText did not
 * match).
 */
export function applyTextEdits(
  path: NuclideUri,
  ...edits: Array<TextEdit>
): boolean {
  const sortedEdits = sortEdits(edits);
  const editor = existingEditorForUri(path);
  invariant(editor != null);
  return applySortedTextEditsToBuffer(editor.getBuffer(), sortedEdits);
}

export function applyTextEditsToBuffer(
  buffer: atom$TextBuffer | simpleTextBuffer$TextBuffer,
  edits: Array<TextEdit>,
): boolean {
  return applySortedTextEditsToBuffer(buffer, sortEdits(edits));
}

function applySortedTextEditsToBuffer(
  buffer: atom$TextBuffer | simpleTextBuffer$TextBuffer,
  edits: Array<TextEdit>,
): boolean {
  // For every edit, the start of its range will be after the end of the
  // previous edit's range.
  if (editsOverlap(edits)) {
    getLogger('text-edit').warn(
      'applyTextEdits was called with overlapping edits.',
    );
    return false;
  }
  // Special-case whole-buffer changes to minimize disruption.
  if (edits.length === 1 && edits[0].oldRange.isEqual(buffer.getRange())) {
    if (edits[0].oldText != null && edits[0].oldText !== buffer.getText()) {
      return false;
    }
    buffer.setTextViaDiff(edits[0].newText);
    return true;
  }

  const checkpoint = buffer.createCheckpoint();

  // Iterate through in reverse order. Edits earlier in the file can move around text later in the
  // file, so to avoid conflicts edits should be applied last first.
  for (let i = edits.length - 1; i >= 0; i--) {
    const edit = edits[i];
    const success = applyToBuffer(buffer, edit);
    if (!success) {
      buffer.revertToCheckpoint(checkpoint);
      return false;
    }
  }

  buffer.groupChangesSinceCheckpoint(checkpoint);
  return true;
}

function applyToBuffer(
  buffer: atom$TextBuffer | simpleTextBuffer$TextBuffer,
  edit: TextEdit,
): boolean {
  if (edit.oldRange.start.row === edit.oldRange.end.row) {
    // A little extra validation when the old range spans only one line. In particular, this helps
    // when the old range is empty so there is no old text for us to compare against. We can at
    // least abort if the line isn't long enough.
    const lineLength = buffer.lineLengthForRow(edit.oldRange.start.row);
    if (edit.oldRange.end.column > lineLength) {
      return false;
    }
  }
  if (edit.oldText != null) {
    const currentText = buffer.getTextInRange(edit.oldRange);
    if (currentText !== edit.oldText) {
      return false;
    }
  }
  buffer.setTextInRange(edit.oldRange, edit.newText);
  return true;
}

// Returns whether an array of sorted TextEdits contain an overlapping range.
function editsOverlap(sortedEdits: Array<TextEdit>): boolean {
  for (let i = 0; i < sortedEdits.length - 1; i++) {
    if (
      sortedEdits[i].oldRange.end.isGreaterThan(
        sortedEdits[i + 1].oldRange.start,
      )
    ) {
      return true;
    }
  }
  return false;
}

function sortEdits(edits: Array<TextEdit>): Array<TextEdit> {
  // stable sort (preserve order of edits starting in the same location)
  return edits
    .map((edit, i) => [edit, i])
    .sort(
      ([e1, i1], [e2, i2]) =>
        e1.oldRange.start.compare(e2.oldRange.start) ||
        e1.oldRange.end.compare(e2.oldRange.end) ||
        i1 - i2,
    )
    .map(([edit]) => edit);
}
