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

import type {TestContext} from './utils/remotable-tests';

import {copyFixture} from '../pkg/nuclide-test-helpers';
import {describeRemote} from './utils/remotable-tests';

describeRemote('Remote Connection', (context: TestContext) => {
  const NEW_FILE_NAME = 'NEW_FILE.txt';

  it("succesfully opens a remote file that doesn't exist", () => {
    waitsForPromise({timeout: 10000}, async () => {
      const repoPath = await copyFixture('cpp_project', __dirname);
      await context.setProject(repoPath);
      const editor = await atom.workspace.open(
        context.getProjectRelativePath(NEW_FILE_NAME),
      );
      expect(editor).not.toBeNull();
      expect(editor.isModified()).toBe(true);
      await editor.saveAs(context.getProjectRelativePath(NEW_FILE_NAME));
      expect(editor.isModified()).toBe(false);
    });
  });
});
