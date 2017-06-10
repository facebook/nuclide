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

import type {TestContext} from './remotable-tests';

import invariant from 'assert';

import {
  fileTreeHasFinishedLoading,
  getVisibleEntryFromFileTree,
} from './file-tree-common';
import pollFor from './pollFor';
import {generateHgRepo1Fixture} from '../../pkg/nuclide-test-helpers';

export function runTest(context: TestContext) {
  it('changes the color of the file in the file tree after an edit', () => {
    waitsForPromise({timeout: 60000}, async () => {
      const projectPath = await generateHgRepo1Fixture();

      // Add this directory as an atom project.
      await context.setProject(projectPath);

      const textEditor = await atom.workspace.open(
        context.getProjectRelativePath('test.txt'),
      );
      invariant(textEditor);
      const textEditorView = atom.views.getView(textEditor);

      textEditor.insertText('abcdef');

      atom.commands.dispatch(textEditorView, 'core:save');

      await fileTreeHasFinishedLoading();

      await pollFor(
        () => {
          const fileElement = getVisibleEntryFromFileTree('test.txt');
          return (
            fileElement != null &&
            fileElement.classList.contains('status-modified')
          );
        },
        'File did not change its appearance in the file-tree',
        30000,
      );
    });
  });
}
