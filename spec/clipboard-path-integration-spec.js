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

import {describeRemotableTest} from './utils/remotable-tests';
import {dispatchKeyboardEvent} from '../pkg/commons-atom/testHelpers';
import {generateHgRepo1Fixture} from '../pkg/nuclide-test-helpers';
import nuclideUri from 'nuclide-commons/nuclideUri';

describeRemotableTest('Clipboard path integration test', context => {
  let repoPath;
  beforeEach(() => {
    waitsForPromise({timeout: 60000}, async () => {
      repoPath = await generateHgRepo1Fixture();
      await context.setProject(repoPath);
      await atom.workspace.open(context.getProjectRelativePath('test.txt'));
    });
  });

  it('correctly copies paths', () => {
    // Absolute path.
    runs(() => {
      // In 1.12 uppercase is required when shift is needed.
      dispatchKeyboardEvent('X', document.activeElement, {
        ctrl: true,
        shift: true,
      });
    });

    // In Atom 1.12 keyboard events are async, so we have to wait for the results.
    waitsFor(
      'absolute path to be copied',
      () => atom.clipboard.read() === nuclideUri.join(repoPath, 'test.txt'),
    );

    // Project-relative path.
    runs(() => {
      dispatchKeyboardEvent('X', document.activeElement, {
        ctrl: true,
        alt: true,
        shift: true,
      });
    });

    waitsFor(
      'project-relative path to be copied',
      () => atom.clipboard.read() === 'test.txt',
    );

    // Repository-relative path.
    runs(() => {
      // Clear the clipboard, since the two are results are the same.
      atom.clipboard.write('');
      dispatchKeyboardEvent('x', document.activeElement, {
        ctrl: true,
        alt: true,
      });
    });

    waitsFor(
      'repository-relative path to be copied',
      () => atom.clipboard.read() === 'test.txt',
    );
  });
});
