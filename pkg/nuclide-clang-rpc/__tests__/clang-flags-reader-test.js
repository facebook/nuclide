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
jest.setTimeout(40000);
import {range} from 'nuclide-commons/collection';
import nullthrows from 'nullthrows';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {generateFixture} from 'nuclide-commons/test-helpers';
import {
  readCompilationFlags,
  fallbackReadCompilationFlags,
} from '../lib/clang-flags-reader';

// Generate a compilation database entry with
// given number of files and number of args per file, return the path on disk.
async function generateDbFixture(
  directory: string,
  files: number,
  args: number,
): Promise<string> {
  const filename = 'compile_commands.json';
  // For very large objects, calling JSON.stringify directly will fail.
  // So we manually construct the start and end of the files.
  let dbString = '[';
  const argList = Array.from(range(0, args)).map(i => `-argNumber${i}`);
  for (let i = 0; i < files; i++) {
    const entry = {
      file: `${directory}/file${i}.cpp`,
      directory,
      arguments: argList,
    };
    dbString += JSON.stringify(entry);
    if (i !== files - 1) {
      // Newline not necessary but it helps if we ever have to manually inspect.
      dbString += ',\n';
    }
  }
  dbString += ']';
  const dir = await generateFixture(
    'clang_rpc',
    new Map([[filename, dbString]]),
  );
  return nuclideUri.join(dir, filename);
}

describe('unit tests for clang-flags-reader.js', () => {
  async function expectFallback(files: number, args: number): Promise<void> {
    const db = await generateDbFixture('/a/b', files, args);
    const entries = await readCompilationFlags(db)
      .toArray()
      .toPromise();
    const fallbackEntries = await fallbackReadCompilationFlags(db);
    expect(entries).toEqual(fallbackEntries);
  }
  async function checkLengths(files: number, args: number): Promise<void> {
    const db = await generateDbFixture('/a/b', files, args);
    const entries = await readCompilationFlags(db)
      .toArray()
      .toPromise();
    expect(entries.length).toEqual(files);
    for (const entry of entries) {
      expect(entry.directory).toEqual('/a/b');
      expect(entry.file.startsWith('/a/b/')).toBeTruthy();
      expect(nullthrows(entry.arguments).length).toEqual(args);
    }
  }

  it('works for a small file', async () => {
    await (async () => expectFallback(3, 3))();
  });
  it('works for very long arguments list', async () => {
    await (async () => expectFallback(2, 40000))();
  });
  it('works for a very large file', async () => {
    // This file is around 250 megabytes (JSON.parse would fail).
    await (async () => checkLengths(3000, 5000))();
  });
  it('fails with embedded braces, but fallback works', async () => {
    await (async () => {
      const db = await generateDbFixture('/a/{b}', 3, 3);
      const fallbackEntries = await fallbackReadCompilationFlags(db);
      let hadError = false;
      await readCompilationFlags(db)
        .toPromise()
        .catch(() => (hadError = true));
      expect(hadError).toBeTruthy();
      // ...but the fallback should still work.
      expect(fallbackEntries.length).toEqual(3);
    })();
  });
});
