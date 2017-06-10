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

import {copyBuildFixture} from '../pkg/nuclide-test-helpers';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {observeProcess} from 'nuclide-commons/process';
import {existingEditorForUri} from 'nuclide-commons-atom/text-editor';
import {describeRemote} from './utils/remotable-tests';

describeRemote('Remote Open', (context: TestContext) => {
  it('tests remote open', () => {
    let localFilePath: string = (null: any);
    let remoteFilePath: string = (null: any);

    waitsForPromise(async () => {
      const repoPath = await copyBuildFixture('python_project_1', __dirname);
      await context.setProject(repoPath);
      localFilePath = nuclideUri.join(repoPath, 'Foo.py');
      remoteFilePath = context.getProjectRelativePath('Foo.py');
    });

    waitsForPromise(async () => {
      // Open file via remote atom command
      const remoteAtomCommand = nuclideUri.join(
        __dirname,
        '../pkg/nuclide-remote-atom-rpc/bin/atom',
      );
      const result = await observeProcess(remoteAtomCommand, [localFilePath])
        .reduce(
          (acc, event) => {
            switch (event.kind) {
              case 'stdout':
                return {...acc, stdout: acc.stdout + event.data};
              case 'stderr':
                return {...acc, stderr: acc.stderr + event.data};
              case 'exit':
                return {...acc, exitCode: event.exitCode};
              default:
                return acc;
            }
          },
          {stdout: '', stderr: '', exitCode: null},
        )
        .toPromise();

      // Process should exit cleanly
      expect(result.exitCode).toEqual(0);
      expect(result.stderr).toEqual('');
      expect(result.stdout).toEqual('');
    });

    waitsFor('File should open up in short order', 10000, () => {
      return existingEditorForUri(remoteFilePath) != null;
    });
  });
});
