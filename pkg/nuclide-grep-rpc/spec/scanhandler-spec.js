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

import type {search$FileResult} from '..';

import {runCommand} from 'nuclide-commons/process';
import {addMatchers} from '../../nuclide-test-helpers';
import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import search from '../lib/scanhandler';
import {generateFixture} from '../../nuclide-test-helpers';

describe('Scan Handler Tests', () => {
  beforeEach(function() {
    addMatchers(this);
  });

  /* UNIX GREP TESTS */
  it('Should recursively scan all files in a directory', () => {
    waitsForPromise(async () => {
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

      const results = await search(folder, /hello world/i, [])
        .toArray()
        .toPromise();
      const expected = JSON.parse(
        fs.readFileSync(
          nuclideUri.join(__dirname, 'fixtures', 'basic.json'),
          'utf8',
        ),
      );

      // Sort results by filename to normalize order.
      sortResults(results);
      expect(results).diffJson(expected);
    });
  });

  it('Can execute a case sensitive search', () => {
    waitsForPromise(async () => {
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

      const results = await search(folder, /hello world/, [])
        .toArray()
        .toPromise();
      const expected = JSON.parse(
        fs.readFileSync(
          nuclideUri.join(__dirname, 'fixtures', 'casesensitive.json'),
          'utf8',
        ),
      );

      // Sort the list of matches by filename to normalize order.
      sortResults(results);
      expect(results).diffJson(expected);
    });
  });

  it('Can execute a search of subdirectories.', () => {
    waitsForPromise(async () => {
      // Setup the test folder.
      const folder = await generateFixture(
        'grep-rpc',
        new Map([
          ['dir1/file.txt', 'console.log("Hello World!");'],
          ['dir2/file.txt', 'console.log("Hello World!");'],
          ['dir3/file.txt', 'console.log("Hello World!");'],
        ]),
      );
      const results = await search(folder, /hello world/i, [
        'dir2',
        'dir3',
        'nonexistantdir',
      ])
        .toArray()
        .toPromise();
      const expected = JSON.parse(
        fs.readFileSync(
          nuclideUri.join(__dirname, 'fixtures', 'subdirs.json'),
          'utf8',
        ),
      );

      // Sort the list of matches by filename to normalize order.
      sortResults(results);
      expect(results).diffJson(expected);
    });
  });

  it('Should include results from files matching wildcard path name', () => {
    waitsForPromise(async () => {
      // Create test folders and files
      const folder = await generateFixture(
        'grep-rpc',
        new Map([
          ['foo.js', 'console.log("a wildcard appears!");'],
          ['foo.py', 'console.log("a wildcard appears!");'],
          ['test/foo.js', 'console.log("a wildcard appears!");'],
        ]),
      );
      const results = await search(folder, /a wildcard appears/i, [
        '*.js',
        'test',
      ])
        .toArray()
        .toPromise();
      const expected = JSON.parse(
        fs.readFileSync(
          nuclideUri.join(__dirname, 'fixtures', 'wildcard.json'),
          'utf8',
        ),
      );

      sortResults(results);
      expect(results).diffJson(expected);
    });
  });

  it('Should include multiple results matching on the same line', () => {
    waitsForPromise(async () => {
      // Setup test files
      const folder = await generateFixture(
        'grep-rpc',
        new Map([
          ['foo.js', 'const foo = require("foo");'],
          ['test/foo.js', 'const foo = require("foo");'],
        ]),
      );
      const results = await search(
        // Need 'g' flag to search all matches. Normally, Atom inserts it for us.
        folder,
        /foo/g,
        ['*.js', 'test'],
      )
        .toArray()
        .toPromise();
      const expected = JSON.parse(
        fs.readFileSync(
          nuclideUri.join(
            __dirname,
            'fixtures',
            'multipleMatchesOnSameLine.json',
          ),
          'utf8',
        ),
      );

      sortResults(results);
      expect(results).diffJson(expected);
    });
  });

  /* GIT GREP TESTS */
  it('Git repo: should ignore untracked files or files listed in .gitignore', () => {
    waitsForPromise(async () => {
      // Create a git repo in a temporary folder.
      const folder = await generateFixture('grep-rpc');
      await runCommand('git', ['init'], {cwd: folder}).toPromise();

      // Create a file that is ignored.
      fs.writeFileSync(nuclideUri.join(folder, '.gitignore'), 'ignored.txt');
      fs.writeFileSync(nuclideUri.join(folder, 'ignored.txt'), 'Hello World!');

      // Create a file that is tracked.
      fs.writeFileSync(nuclideUri.join(folder, 'tracked.txt'), 'Hello World!');
      await runCommand('git', ['add', 'tracked.txt'], {
        cwd: folder,
      }).toPromise();

      // Create a file that is untracked.
      fs.writeFileSync(
        nuclideUri.join(folder, 'untracked.txt'),
        'Hello World!',
      );

      const results = await search(folder, /hello world/i, [])
        .toArray()
        .toPromise();
      const expected = JSON.parse(
        fs.readFileSync(
          nuclideUri.join(__dirname, 'fixtures', 'repo.json'),
          'utf8',
        ),
      );

      // Sort the list of matches by filename to normalize order.
      sortResults(results);
      expect(results).diffJson(expected);
    });
  });

  // HG Grep test. This test is disabled due to differences in the behavior of
  // Mercurial between v3.3 (where hg grep searches the revision history), and v3.4
  // (where hg grep) searches the working directory.
  // eslint-disable-next-line jasmine/no-disabled-tests
  xit(
    'Hg repo: should ignore untracked files or files listed in .hgignore',
    () => {
      waitsForPromise(async () => {
        // Create a git repo in a temporary folder.
        const folder = await generateFixture('grep-rpc');
        await runCommand('hg', ['init'], {cwd: folder}).toPromise();

        // Create a file that is ignored.
        fs.writeFileSync(nuclideUri.join(folder, '.hgignore'), 'ignored.txt');
        fs.writeFileSync(
          nuclideUri.join(folder, 'ignored.txt'),
          'Hello World!',
        );

        // Create a file that is tracked.
        fs.writeFileSync(
          nuclideUri.join(folder, 'tracked.txt'),
          'Hello World!',
        );
        await runCommand('hg', ['add', 'tracked.txt'], {
          cwd: folder,
        }).toPromise();

        // Create a file that is untracked.
        fs.writeFileSync(
          nuclideUri.join(folder, 'untracked.txt'),
          'Hello World!',
        );

        await runCommand('hg', ['commit', '-m', 'test commit'], {
          cwd: folder,
        }).toPromise();

        const results = await search(folder, /hello world()/i, [])
          .toArray()
          .toPromise();
        const expected = JSON.parse(
          fs.readFileSync(
            nuclideUri.join(__dirname, 'fixtures', 'repo.json'),
            'utf8',
          ),
        );

        // Sort the list of matches by filename to normalize order.
        sortResults(results);
        expect(results).diffJson(expected);
      });
    },
  );
});

// Helper function to sort an array of file results - first by their filepath,
// and then by the number of matches.
function sortResults(results: Array<search$FileResult>) {
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
