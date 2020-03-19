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

import {
  activateAllPackages,
  jasmineIntegrationTestSetup,
  deactivateAllPackages,
  startNuclideServer,
  addRemoteProject,
  stopNuclideServer,
} from './utils/integration-test-helpers';
import pollFor from './utils/pollFor';
import {generateHgRepo1Fixture} from '../pkg/nuclide-test-helpers';
import nuclideUri from 'nuclide-commons/nuclideUri';
import fs from 'fs';

import invariant from 'assert';

describe('Edit remote file Integration Test', () => {
  it('supports editing, saving and the modified status detection of remote files', () => {
    waitsForPromise({timeout: 70000}, async () => {
      // Configure some jasmine specific things for integration testing.
      jasmineIntegrationTestSetup();
      // Activate nuclide packages.
      await activateAllPackages();

      const repoPath = await generateHgRepo1Fixture();
      await startNuclideServer();
      const connection = await addRemoteProject(repoPath);
      invariant(connection, 'Failed to make connection to a remote server');

      const remotePath = nuclideUri.join(repoPath, 'test.txt');
      const textEditor = await atom.workspace.open(
        connection.getConnection().getUriOfRemotePath(remotePath),
      );
      invariant(textEditor);
      const textEditorView = atom.views.getView(textEditor);

      textEditor.insertText('abcdef');

      expect(textEditor.isModified()).toBe(true);

      atom.commands.dispatch(textEditorView, 'core:save');

      await pollFor(
        () => textEditor.isModified() === false,
        'Text editor did not lose its modified status',
        5000,
      );

      const fsContents = fs.readFileSync(remotePath).toString();
      expect(fsContents).toEqual(textEditor.getText());

      textEditor.insertText('ghijkl');

      expect(textEditor.isModified()).toBe(true);

      await stopNuclideServer(connection);
      // Deactivate nuclide packages.
      await deactivateAllPackages();
    });
  });
});
