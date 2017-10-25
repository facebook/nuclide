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

import {
  enforceReadOnlyEditor,
  existingEditorForUri,
  observeTextEditors,
} from '../text-editor';

import {Point, Range} from 'atom';

describe('existingEditorForUri', () => {
  const file1 = '/tmp/file1.txt';
  const file2 = '/tmp/file2.txt';
  const file3 = '/tmp/file3.txt';

  let file1Editor: atom$TextEditor = (null: any);
  let file2Editor: atom$TextEditor = (null: any);
  let secondFile2Editor: atom$TextEditor = (null: any);

  beforeEach(() => {
    waitsForPromise(async () => {
      file1Editor = await atom.workspace.open(file1);
      file2Editor = await atom.workspace.open(file2);
      secondFile2Editor = await atom.workspace.open(file2);
    });
  });

  it('should find the one editor for a file', () => {
    expect(existingEditorForUri(file1)).toBe(file1Editor);
  });

  it('should find one of the editors for a file', () => {
    const editor = existingEditorForUri(file2);
    expect(editor === file2Editor || editor === secondFile2Editor).toBeTruthy();
  });

  it('should return null if no editor exists', () => {
    expect(existingEditorForUri(file3)).toBeNull();
  });
});

describe('observeTextEditors', () => {
  it('should ignore broken remote paths', () => {
    waitsForPromise(async () => {
      const paths = [];
      observeTextEditors(editor => paths.push(editor.getPath()));

      await atom.workspace.open('nuclide:/test');
      await atom.workspace.open('');
      await atom.workspace.open('/tmp/test');

      expect(paths).toEqual([undefined, '/tmp/test']);
    });
  });
});

function ensureReadOnlyOperations(
  buffer: atom$TextBuffer,
  operations: Array<() => mixed>,
  expectedReadOnly: boolean,
): void {
  const initialText = buffer.getText();
  operations.forEach(operation => {
    operation();
    expect(initialText === buffer.getText()).toBe(expectedReadOnly);
    if (!expectedReadOnly) {
      buffer.setText(initialText);
    }
  });
}

describe('enforceReadOnlyEditor', () => {
  it('should not be able to write to the text editor', () => {
    waitsForPromise(async () => {
      const editor = await atom.workspace.open('');
      editor.setText('ABC\nDEF');
      const buffer = editor.getBuffer();

      const operations = [
        () => editor.insertText('xyz'),
        () => editor.backspace(),
        () => editor.duplicateLines(),
        () => editor.insertNewline(),
      ];

      ensureReadOnlyOperations(buffer, operations, false);

      enforceReadOnlyEditor(editor);
      ensureReadOnlyOperations(buffer, operations, true);
      // Underlying buffer's `setText` and `append` are an exception by default.
      ensureReadOnlyOperations(
        buffer,
        [() => buffer.setText('lol'), () => buffer.append('lol')],
        false,
      );
    });
  });
});

describe('enforceReadOnlyBuffer', () => {
  it('should not be able to write to the text buffer', () => {
    waitsForPromise(async () => {
      const editor = await atom.workspace.open('');
      const buffer = editor.getBuffer();
      buffer.setText('ABC\nDEF');

      const operations = [
        () => buffer.append('xyz'),
        () => buffer.deleteRows(0, 1),
        () => buffer.delete(new Range([0, 0], [1, 0])),
        () => buffer.insert(new Point(0, 0), 'lol'),
        () => buffer.undo(),
        () => buffer.setText('lol'),
      ];

      ensureReadOnlyOperations(buffer, operations, false);
      enforceReadOnlyEditor(editor, []);
      ensureReadOnlyOperations(buffer, operations, true);
    });
  });
});
