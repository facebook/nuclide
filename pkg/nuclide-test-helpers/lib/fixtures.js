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

// This is in devDependencies. This file should only be used in tests.
// eslint-disable-next-line nuclide-internal/no-unresolved
import fse from 'fs-extra';
import temp from 'temp';
import invariant from 'assert';

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand} from 'nuclide-commons/process';
import {generateFixture} from 'nuclide-commons/test-helpers';

const testFileContent = 'this is the base file\nline 2\n\n  indented line\n';

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
 * Generates an hg repository with the following structure:
 *
 *   o second commit [secondCommit]
 *  /
 * |
 * |
 * | o first commit [firstCommit]
 * |/
 * |
 * |
 * o base commit
 *
 * @returns the path to the temporary directory that this function creates.
 */
export async function generateHgRepo3Fixture(
  fileName?: string = 'temp.txt',
): Promise<string> {
  const testTxt = 'this is the base file\nline 2\n\n  indented line\n';
  const tempDir = await generateFixture(
    'hg_repo_3',
    new Map([['.watchmanconfig', '{}\n'], [fileName, testTxt]]),
  );
  const repoPath = await fsPromise.realpath(tempDir);
  await runCommand('hg', ['init'], {cwd: repoPath}).toPromise();
  await fsPromise.writeFile(
    nuclideUri.join(repoPath, '.hg', 'hgrc'),
    '[paths]\ndefault = .\n[ui]\nusername = Test <test@mail.com>\n',
  );
  await fsPromise.writeFile(nuclideUri.join(repoPath, fileName), testTxt);
  await runCommand('hg', ['commit', '-A', '-m', 'base commit'], {
    cwd: repoPath,
  }).toPromise();
  await fsPromise.writeFile(
    nuclideUri.join(repoPath, fileName),
    testTxt + '\nthis line added on first commit\n',
  );
  await runCommand('hg', ['bookmark', 'firstCommit'], {
    cwd: repoPath,
  }).toPromise();
  await runCommand('hg', ['commit', '-A', '-m', 'first commit'], {
    cwd: repoPath,
  }).toPromise();
  await runCommand('hg', ['prev'], {
    cwd: repoPath,
  }).toPromise();
  await fsPromise.writeFile(
    nuclideUri.join(repoPath, fileName),
    testTxt + '\nthis line added on second commit\n',
  );
  await runCommand('hg', ['bookmark', 'secondCommit'], {
    cwd: repoPath,
  }).toPromise();
  await runCommand('hg', ['commit', '-A', '-m', 'second commit'], {
    cwd: repoPath,
  }).toPromise();
  return repoPath;
}

export async function overwriteFileWithTestContent(
  fileName: string,
  repoPath: string,
  fileContent?: string = testFileContent,
): Promise<void> {
  await fsPromise.writeFile(nuclideUri.join(repoPath, fileName), fileContent);
}

/**
 * Generates an hg repository with the following structure:
 *
 * @ other commit
 * |
 * |  o commit 4   <- you are here
 * |  |
 * |  o commit 3
 * |  |
 * |  o commit 2
 * |  |
 * |  o commit 1
 * | /
 * |/
 * o base commit
 *
 * @returns the path to the temporary directory that this function creates.
 */
export async function generateHgRepo4Fixture(): Promise<string> {
  const testTxt = 'this is a test file\n';

  const tempDir = await generateFixture(
    'hg_repo_4',
    new Map([
      ['.watchmanconfig', '{}\n'],
      ['test.txt', testTxt],
      ['test_1.txt', ''],
      ['test_2.txt', ''],
      ['test_3.txt', ''],
      ['test_4.txt', ''],
    ]),
  );
  const repoPath = await fsPromise.realpath(tempDir);
  await runCommand('hg', ['init'], {cwd: repoPath}).toPromise();
  await fsPromise.writeFile(
    nuclideUri.join(repoPath, '.hg', 'hgrc'),
    '[paths]\ndefault = .\n[ui]\nusername = Test <test@mail.com>\n\n' +
      '[extensions]\nhistedit =\nfbhistedit =\n',
  );
  await runCommand('hg', ['commit', '-A', '-m', 'base commit'], {
    cwd: repoPath,
  }).toPromise();
  // make the base a public commit so that smartlog shows all children
  await runCommand('hg', ['phase', '-p'], {
    cwd: repoPath,
  }).toPromise();

  await fsPromise.writeFile(
    nuclideUri.join(repoPath, 'test.txt'),
    testTxt + '\n\nmore added here',
  );
  await runCommand('hg', ['commit', '-A', '-m', 'other commit'], {
    cwd: repoPath,
  }).toPromise();
  await runCommand('hg', ['update', '.^'], {
    cwd: repoPath,
  }).toPromise();

  for (let i = 1; i < 5; i++) {
    // eslint-disable-next-line no-await-in-loop
    await fsPromise.writeFile(
      nuclideUri.join(repoPath, `test_${i}.txt`),
      `this is test file ${i}`,
    );
    // eslint-disable-next-line no-await-in-loop
    await runCommand('hg', ['commit', '-A', '-m', `commit ${i}`], {
      cwd: repoPath,
    }).toPromise();
  }

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
      return fsPromise.mv(prevName, newName);
    }),
  );
}
