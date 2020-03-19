/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {TestContext} from './utils/remotable-tests';

import {getFileSystemServiceByNuclideUri} from '../pkg/nuclide-remote-connection';
import {copyFixture} from '../pkg/nuclide-test-helpers';
import {describeRemote} from './utils/remotable-tests';

describeRemote('Remote Connection', (context: TestContext) => {
  const NEW_FILE_NAME = 'NEW_FILE.txt';

  it("successfully opens and saves a remote file that doesn't exist", () => {
    let editor;
    let fileName;

    waitsForPromise({timeout: 10000}, async () => {
      const repoPath = await copyFixture('cpp_project', __dirname);
      await context.setProject(repoPath);
      fileName = context.getProjectRelativePath(NEW_FILE_NAME);
      editor = await atom.workspace.open(fileName);
      expect(editor).not.toBeNull();
      editor.setText('test1234');
    });

    waitsFor(() => editor.isModified());

    waitsForPromise(async () => {
      await editor.save();
    });

    waitsFor(() => !editor.isModified());

    waitsForPromise(async () => {
      const fsService = getFileSystemServiceByNuclideUri(fileName);
      const buffer = await fsService.readFile(fileName);
      expect(buffer.toString()).toBe('test1234');
    });
  });
});
