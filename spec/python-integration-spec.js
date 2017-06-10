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

import {waitsForFile} from '../pkg/commons-atom/testHelpers';
import {copyFixture} from '../pkg/nuclide-test-helpers';
import {describeRemotableTest} from './utils/remotable-tests';
import {
  getAutocompleteSuggestions,
  waitsForAutocompleteSuggestions,
} from './utils/autocomplete-common';
import {waitsForHyperclickResult} from './utils/hyperclick-common';

describeRemotableTest('Python Integration Test', context => {
  let pyProjPath;
  let textEditor: atom$TextEditor = (null: any);

  it('supports autocompletion and hyperclick', () => {
    waitsForPromise({timeout: 60000}, async () => {
      pyProjPath = await copyFixture('python_project_1', __dirname);
      await context.setProject(pyProjPath);
      textEditor = await atom.workspace.open(
        context.getProjectRelativePath('Foo.py'),
      );
    });

    waitsForFile('Foo.py');

    // Autocompletion
    runs(() => {
      // Trigger autocompletion.
      textEditor.setCursorBufferPosition([13, 1]);
      textEditor.insertText('os.pa');
      textEditor.insertText('t');
    });

    waitsForAutocompleteSuggestions();

    runs(() => {
      const items = getAutocompleteSuggestions();
      // The first suggestion should be 'path' as in 'os.path'.
      expect(items[0]).toEqual({
        word: 'path',
        leftLabel: '',
        rightLabel: '',
      });
    });

    // Hyperclick
    waitsForHyperclickResult([6, 8], 'os.py', [0, 0]);
  });
});
