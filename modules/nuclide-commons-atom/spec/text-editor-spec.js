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

import {existingEditorForUri, observeTextEditors} from '../text-editor';

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
