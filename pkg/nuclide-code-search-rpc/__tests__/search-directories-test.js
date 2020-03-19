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
import type {search$FileResult} from '../lib/types';

import {remoteAtomSearch} from '../lib/CodeSearchService';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand} from 'nuclide-commons/process';
import {generateFixture} from 'nuclide-commons/test-helpers';

const TOOL = 'grep';

describe('Remote Atom Search by directory', () => {
  /* UNIX GREP TESTS */
  it('Should recursively scan all files in a directory', async () => {
    // Setup the test folder.
    const folder = await generateFixture(
      'grep-rpc',
      new Map([
        [
          'file1.js',
          `var a = 4;
        console.log("Hello World!");
        console.log(a);
        console.error("Hello World!");`,
        ],
        [
          'directory/file2.js',
          `var a = 4;
        console.log("Hello World!");
        console.log(a);`,
        ],
      ]),
    );

    const results = await remoteAtomSearch(
      folder,
      /hello world/i,
      [],
      false,
      TOOL,
    )
      .refCount()
      .toArray()
      .toPromise();
    sortResults(results, folder);
    expect(results).toMatchSnapshot();
  });

  it('Can execute a case sensitive search', async () => {
    // Setup the test folder.
    const folder = await generateFixture(
      'grep-rpc',
      new Map([
        [
          'file1.js',
          `var a = 4;
        console.log("Hello World!");
        console.log(a);
        console.error("hello world!");`,
        ],
      ]),
    );

    const results = await remoteAtomSearch(
      folder,
      /hello world/,
      [],
      false,
      TOOL,
    )
      .refCount()
      .toArray()
      .toPromise();
    sortResults(results, folder);
    expect(results).toMatchSnapshot();
  });

  it('Does not crash with no results', async () => {
    // Setup the (empty) test folder.
    const folder = await generateFixture('grep-rpc', new Map());

    const results = await remoteAtomSearch(folder, /hello/, [], false, TOOL)
      .refCount()
      .toArray()
      .toPromise();
    sortResults(results, folder);
    expect(results).toMatchSnapshot();
  });

  it('Can execute a search of subdirectories.', async () => {
    // Setup the test folder.
    const folder = await generateFixture(
      'grep-rpc',
      new Map([
        ['dir1/file.txt', 'console.log("Hello World!");'],
        ['dir2/file.txt', 'console.log("Hello World!");'],
        ['dir3/file.txt', 'console.log("Hello World!");'],
      ]),
    );
    const results = await remoteAtomSearch(
      folder,
      /hello world/i,
      ['dir2', 'dir3', 'nonexistantdir'],
      false,
      TOOL,
    )
      .refCount()
      .toArray()
      .toPromise();
    sortResults(results, folder);
    expect(results).toMatchSnapshot();
  });

  it('Should include results from files matching wildcard path name', async () => {
    // Create test folders and files
    const folder = await generateFixture(
      'grep-rpc',
      new Map([
        ['foo.js', 'console.log("a wildcard appears!");'],
        ['foo.py', 'console.log("a wildcard appears!");'],
        ['test/foo.js', 'console.log("a wildcard appears!");'],
      ]),
    );
    const results = await remoteAtomSearch(
      folder,
      /a wildcard appears/i,
      ['*.js', 'test'],
      false,
      TOOL,
    )
      .refCount()
      .toArray()
      .toPromise();
    sortResults(results, folder);
    expect(results).toMatchSnapshot();
  });

  it('Should include multiple results matching on the same line', async () => {
    // Setup test files
    const folder = await generateFixture(
      'grep-rpc',
      new Map([
        ['foo.js', 'const foo = require("foo");'],
        ['test/foo.js', 'const foo = require("foo");'],
      ]),
    );
    const results = await remoteAtomSearch(
      // Need 'g' flag to search all matches. Normally, Atom inserts it for us.
      folder,
      /foo/g,
      ['*.js', 'test'],
      false,
      TOOL,
    )
      .refCount()
      .toArray()
      .toPromise();
    sortResults(results, folder);
    expect(results).toMatchSnapshot();
  });

  it('Should include results from hidden files.', async () => {
    // Setup test files
    const folder = await generateFixture(
      'grep-rpc',
      new Map([
        ['.foo.js', 'const foo = 1;'],
        ['test/.foo.js', 'const foo = 1;'],
      ]),
    );
    const results = await remoteAtomSearch(
      // Need 'g' flag to search all matches. Normally, Atom inserts it for us.
      folder,
      /foo/g,
      ['*.js', 'test'],
      false,
      TOOL,
    )
      .refCount()
      .toArray()
      .toPromise();
    sortResults(results, folder);
    expect(results).toMatchSnapshot();
  });

  /* GIT GREP TESTS */
  it('Git repo: should ignore untracked files or files listed in .gitignore', async () => {
    // Create a git repo in a temporary folder.
    const folder = await generateFixture('grep-rpc');
    await runCommand('git', ['init'], {cwd: folder}).toPromise();

    // Create a file that is ignored.
    fs.writeFileSync(nuclideUri.join(folder, '.gitignore'), 'ignored.txt');
    fs.writeFileSync(nuclideUri.join(folder, 'ignored.txt'), 'Hello World!');

    // Create a file that is tracked.
    fs.writeFileSync(
      nuclideUri.join(folder, 'tracked.txt'),
      'Hello World!\ntest',
    );
    await runCommand('git', ['add', 'tracked.txt'], {
      cwd: folder,
    }).toPromise();

    // Create a file that is untracked.
    fs.writeFileSync(nuclideUri.join(folder, 'untracked.txt'), 'Hello World!');

    const results = await remoteAtomSearch(
      folder,
      /hello world/i,
      [],
      true,
      null,
      /* leadingLines */ 1,
      /* trailingLines */ 1,
    )
      .refCount()
      .toArray()
      .toPromise();
    sortResults(results, folder);
    expect(results).toMatchSnapshot();
  });

  it('Should include leading and trailing context', async () => {
    // Create test folders and files
    const folder = await generateFixture(
      'grep-rpc',
      new Map([['foo.js', 'test1\ntest2\ntest3\n']]),
    );
    const results = await remoteAtomSearch(
      folder,
      /test2/i,
      ['*.js', 'test'],
      false,
      TOOL,
      /* leadingLines */ 2,
      /* trailingLines */ 2,
    )
      .refCount()
      .toArray()
      .toPromise();
    sortResults(results, folder);
    expect(results).toMatchSnapshot();
  });

  it('Hg repo: should ignore untracked files or files listed in .gitignore', async () => {
    // Create an hg repo in a temporary folder.
    const folder = await generateFixture('grep-rpc');
    await runCommand('hg', ['init'], {cwd: folder}).toPromise();

    // Create a file that is ignored.
    fs.writeFileSync(nuclideUri.join(folder, '.gitignore'), 'ignored.txt\n');
    fs.writeFileSync(nuclideUri.join(folder, 'ignored.txt'), 'Hello World!');

    // Create a file that is tracked.
    fs.writeFileSync(
      nuclideUri.join(folder, 'tracked.txt'),
      'Hello World!\ntest',
    );
    await runCommand('hg', ['add', 'tracked.txt'], {
      cwd: folder,
    }).toPromise();

    // Create a file that is untracked.
    fs.writeFileSync(nuclideUri.join(folder, 'untracked.txt'), 'Hello World!');

    await runCommand('hg', ['commit', '-m', 'test commit'], {
      cwd: folder,
    }).toPromise();

    const results = await remoteAtomSearch(
      folder,
      /hello world/i,
      [],
      true,
      null,
      /* leadingLines */ 1,
      /* trailingLines */ 1,
    )
      .refCount()
      .toArray()
      .toPromise();
    sortResults(results, folder);
    expect(results).toMatchSnapshot();
  });
});

// Helper function to sort an array of file results - first by their filepath,
// and then by the number of matches.
// This also relativizes paths (since they're in a tmpdir).
function sortResults(results: Array<search$FileResult>, folder: string) {
  results.forEach(result => {
    result.filePath = nuclideUri.relative(folder, result.filePath);
  });
  results.sort((a, b) => {
    if (a.filePath < b.filePath) {
      return -1;
    } else if (a.filePath > b.filePath) {
      return 1;
    } else {
      return a.matches.length - b.matches.length;
    }
  });
}
