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

import fs from 'fs';
import fse from 'fs-extra';
import temp from 'temp';
import invariant from 'assert';

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {asyncLimit} from 'nuclide-commons/promise';
import {runCommand} from 'nuclide-commons/process';

/**
 * Traverses up the parent directories looking for `fixtures/FIXTURE_NAME`.
 * When found, it's copied to $TMP. Example:
 *
 *    const fixtureDir = await copyFixture('foo', __dirname)
 *
 *    1. Starts looking for `fixtures/foo` in `__dirname`, going up the parent
 *       until it's found.
 *    2. Copies `__dirname/fixtures/foo` to `$TMP/random-foo-temp-name`.
 *
 * When the process exists, the temporary directory is removed.
 *
 * @param fixtureName The name of the subdirectory of the fixtures/ directory
 * that should be copied.
 * @param startDir The calling function should call `__dirname` as this argument.
 * This should correspond to the spec/ directory with a fixtures/ subdirectory.
 * @returns the path to the temporary directory.
 */
export async function copyFixture(
  fixtureName: string,
  startDir: string,
): Promise<string> {
  const fixturePath = nuclideUri.join('fixtures', fixtureName);
  const fixtureRoot = await fsPromise.findNearestFile(fixturePath, startDir);
  invariant(fixtureRoot != null, 'Could not find source fixture.');
  const sourceDir = nuclideUri.join(fixtureRoot, fixturePath);

  temp.track();
  const tempDir = await fsPromise.tempdir(fixtureName);
  const realTempDir = await fsPromise.realpath(tempDir);

  // Recursively copy the contents of the fixture to the temp directory.
  await new Promise((resolve, reject) => {
    fse.copy(sourceDir, realTempDir, (err: ?Error) => {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });

  return realTempDir;
}

/**
 * Generates an hg repository with the following structure:
 *
 * @ second commit
 * |
 * |
 * o first commit
 *
 * @returns the path to the temporary directory that this function creates.
 */
export async function generateHgRepo1Fixture(): Promise<string> {
  const testTxt = 'this is a test file\nline 2\n\n  indented line\n';
  const tempDir = await generateFixture(
    'hg_repo_1',
    new Map([['.watchmanconfig', '{}\n'], ['test.txt', testTxt]]),
  );
  const repoPath = await fsPromise.realpath(tempDir);
  await runCommand('hg', ['init'], {cwd: repoPath}).toPromise();
  await fsPromise.writeFile(
    nuclideUri.join(repoPath, '.hg', 'hgrc'),
    '[ui]\nusername = Test <test@mail.com>\n',
  );
  await runCommand('hg', ['commit', '-A', '-m', 'first commit'], {
    cwd: repoPath,
  }).toPromise();
  await fsPromise.writeFile(
    nuclideUri.join(repoPath, 'test.txt'),
    testTxt + '\nthis line added on second commit\n',
  );
  await runCommand('hg', ['commit', '-A', '-m', 'second commit'], {
    cwd: repoPath,
  }).toPromise();
  return repoPath;
}

/**
 * Generates an hg repository with the following structure:
 *
 * @ add .arcconfig to select mercurial compare default
 * |
 * |
 * o second commit
 * |
 * |
 * o first commit
 *
 * @returns the path to the temporary directory that this function creates.
 */
export async function generateHgRepo2Fixture(): Promise<string> {
  const testTxt = 'this is a test file\nline 2\n\n  indented line\n';
  const tempDir = await generateFixture(
    'hg_repo_2',
    new Map([['.watchmanconfig', '{}\n'], ['test.txt', testTxt]]),
  );
  const repoPath = await fsPromise.realpath(tempDir);
  await runCommand('hg', ['init'], {cwd: repoPath}).toPromise();
  await fsPromise.writeFile(
    nuclideUri.join(repoPath, '.hg', 'hgrc'),
    '[paths]\ndefault = .\n[ui]\nusername = Test <test@mail.com>\n',
  );
  await runCommand('hg', ['commit', '-A', '-m', 'first commit'], {
    cwd: repoPath,
  }).toPromise();
  await fsPromise.writeFile(
    nuclideUri.join(repoPath, 'test.txt'),
    testTxt + '\nthis line added on second commit\n',
  );
  await runCommand('hg', ['commit', '-A', '-m', 'second commit'], {
    cwd: repoPath,
  }).toPromise();
  await fsPromise.writeFile(
    nuclideUri.join(repoPath, '.arcconfig'),
    '{\n  "arc.feature.start.default": "master"\n}\n',
  );
  await runCommand('hg', ['commit', '-A', '-m', 'add .arcconfig to set base'], {
    cwd: repoPath,
  }).toPromise();
  await runCommand(
    'hg',
    [
      'bookmark',
      '--rev',
      '.~2',
      'master',
      '--config',
      'remotenames.disallowedbookmarks=',
    ],
    {cwd: repoPath},
  ).toPromise();
  return repoPath;
}

/**
 * Like `copyMercurialFixture` but looks in the entire fixture directory for
 * `BUCK-rename` and `TARGETS-rename` and inserts a .buckversion if applicable.
 *
 * @param fixtureName The name of the subdirectory of the `fixtures/` directory.
 * @returns the path to the temporary directory that this function creates.
 */
export async function copyBuildFixture(
  fixtureName: string,
  source: string,
): Promise<string> {
  const projectDir = await copyFixture(fixtureName, source);

  await Promise.all([copyBuckVersion(projectDir), renameBuckFiles(projectDir)]);

  return projectDir;
}

async function copyBuckVersion(projectDir: string) {
  const versionFile = '.buckversion';
  const buckVersionDir = await fsPromise.findNearestFile(
    versionFile,
    __dirname,
  );
  if (buckVersionDir != null) {
    await fsPromise.copy(
      nuclideUri.join(buckVersionDir, versionFile),
      nuclideUri.join(projectDir, versionFile),
    );
  }
}

async function renameBuckFiles(projectDir: string) {
  const renames = await fsPromise.glob('**/{BUCK,TARGETS}-rename', {
    cwd: projectDir,
  });
  await Promise.all(
    renames.map(name => {
      const prevName = nuclideUri.join(projectDir, name);
      const newName = prevName.replace(/-rename$/, '');
      return fsPromise.rename(prevName, newName);
    }),
  );
}

/**
 * Takes of Map of file/file-content pairs, and creates a temp dir that matches
 * the file structure of the Map. Example:
 *
 * generateFixture('myfixture', new Map([
 *   ['foo.js'],
 *   ['bar/baz.txt', 'some text'],
 * ]));
 *
 * Creates:
 *
 * /tmp/myfixture_1/foo.js (empty file)
 * /tmp/myfixture_1/bar/baz.txt (with 'some text')
 */
export async function generateFixture(
  fixtureName: string,
  files: ?Map<string, ?string>,
): Promise<string> {
  temp.track();

  const MAX_CONCURRENT_FILE_OPS = 100;
  const tempDir = await fsPromise.tempdir(fixtureName);

  if (files == null) {
    return tempDir;
  }

  // Map -> Array with full paths
  const fileTuples = Array.from(files, tuple => {
    // It's our own array - it's ok to mutate it
    tuple[0] = nuclideUri.join(tempDir, tuple[0]);
    return tuple;
  });

  // Dedupe the dirs that we have to make.
  const dirsToMake = fileTuples
    .map(([filename]) => nuclideUri.dirname(filename))
    .filter((dirname, i, arr) => arr.indexOf(dirname) === i);

  await asyncLimit(dirsToMake, MAX_CONCURRENT_FILE_OPS, dirname =>
    fsPromise.mkdirp(dirname),
  );

  await asyncLimit(
    fileTuples,
    MAX_CONCURRENT_FILE_OPS,
    ([filename, contents]) => {
      // We can't use fsPromise/fs-plus because it does too much extra work.
      // They call `mkdirp` before `writeFile`. We know that the target dir
      // exists, so we can optimize by going straight to `fs`. When you're
      // making 10k files, this adds ~500ms.
      return new Promise((resolve, reject) => {
        fs.writeFile(filename, contents || '', err => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    },
  );

  return tempDir;
}
