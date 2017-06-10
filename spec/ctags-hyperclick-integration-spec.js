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

import {copyFixture} from '../pkg/nuclide-test-helpers';
import {describeRemotableTest} from './utils/remotable-tests';
import {
  waitsForHyperclickResult,
  waitsForMultipleHyperclickResults,
} from './utils/hyperclick-common';

describeRemotableTest('Ctags Hyperclick', context => {
  it('tests ctags hyperclick example', () => {
    let textEditor: atom$TextEditor;
    waitsForPromise({timeout: 60000}, async () => {
      // Create a temporary directory and some test files.
      const testDir = await copyFixture('ctags_project', __dirname);
      await context.setProject(testDir);
      textEditor = await atom.workspace.open(
        context.getProjectRelativePath('a.txt'),
      );
    });

    waitsForHyperclickResult([0, 5], 'a.txt', [0, 0]);

    // 'b' has multiple options.
    runs(() => {
      textEditor.setCursorBufferPosition([3, 5]);
    });

    waitsForMultipleHyperclickResults(
      [3, 5],
      ['b (a.txt)', 'function test::b (b.txt)'],
    );
  });
});
