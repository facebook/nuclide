/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 * @format
 * @emails oncall+nuclide
 */
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand} from 'nuclide-commons/process';
import {
  aFileSearchShould,
  createTestFolder,
} from '../__mocks__/a_file_search_should';

jest.setTimeout(30000);

async function hgTestFolder(): Promise<string> {
  const folder = await createTestFolder();

  await runCommand('hg', ['init'], {cwd: folder}).toPromise();
  await runCommand('hg', ['addremove'], {cwd: folder}).toPromise();

  // After adding the existing files to hg, add an ignored file to
  // prove we're using hg to populate the list.
  const ignoredFile = 'ignored';
  fs.writeFileSync(nuclideUri.join(folder, ignoredFile), '');
  fs.writeFileSync(
    nuclideUri.join(folder, '.hgignore'),
    `.hgignore\n${ignoredFile}`,
  );

  return folder;
}

aFileSearchShould('Mercurial', hgTestFolder);
