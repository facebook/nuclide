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
import {range} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {generateFixture} from 'nuclide-commons/test-helpers';
import {RelatedFileFinder} from '../lib/related-file/finders';

describe('getRelatedSourceForHeader', () => {
  const finder = new RelatedFileFinder();

  it('does not fall back to a source file when looking for a source in a non-buck project', async () => {
    const tmpdir = await generateFixture(
      'clang_rpc',
      new Map([['a/compile_commands.json', ''], ['a/source.cpp', '']]),
    );
    const file = await finder.getRelatedSourceForHeader(
      nuclideUri.join(tmpdir, 'a/header.h'),
    );
    expect(file).toBeFalsy();
  });

  it('is able to find an absolute include with project root but with a different real root', async () => {
    jest
      .spyOn(finder, '_getFBProjectRoots')
      .mockReturnValue(['project/subproject']);
    const tmpdir = await generateFixture(
      'clang_rpc',
      new Map([
        [
          'a/project/subproject/subroot/source.cpp',
          '#include "subroot/header.h"',
        ],
      ]),
    );
    const sourceFile = nuclideUri.join(
      tmpdir,
      'a/project/subproject/subroot/source.cpp',
    );
    const file = await finder.getRelatedSourceForHeader(
      nuclideUri.join(tmpdir, 'a/project/subproject/subroot/header.h'),
      nuclideUri.join(tmpdir, 'a/project/subproject/subroot'),
    );
    expect(file).toBe(sourceFile);
  });

  it('is able to find an absolute include without project root', async () => {
    jest
      .spyOn(finder, '_getFBProjectRoots')
      .mockReturnValue(['project/subproject']);
    const tmpdir = await generateFixture(
      'clang_rpc',
      new Map([
        [
          'a/project/subproject/subroot/source.cpp',
          '#include "subroot/boom/header.h"',
        ],
      ]),
    );
    const sourceFile = nuclideUri.join(
      tmpdir,
      'a/project/subproject/subroot/source.cpp',
    );
    const file = await finder.getRelatedSourceForHeader(
      nuclideUri.join(tmpdir, 'a/project/subproject/subroot/boom/header.h'),
    );
    expect(file).toBe(sourceFile);
  });

  it('is able to find an absolute include', async () => {
    const tmpdir = await generateFixture(
      'clang_rpc',
      new Map([['a/b.cpp', '#include <a/b.h>']]),
    );
    const sourceFile = nuclideUri.join(tmpdir, 'a/b.cpp');
    const file = await finder.getRelatedSourceForHeader(
      nuclideUri.join(tmpdir, 'a/b.h'),
      tmpdir,
    );
    expect(file).toBe(sourceFile);
  });

  it('is able to find a relative include', async () => {
    const tmpdir = await generateFixture(
      'clang_rpc',
      new Map([['a/x.cpp', '#include <../x.h>']]),
    );
    const sourceFile = nuclideUri.join(tmpdir, 'a/x.cpp');
    const file = await finder.getRelatedSourceForHeader(
      nuclideUri.join(tmpdir, 'x.h'),
      tmpdir,
    );
    expect(file).toBe(sourceFile);
  });

  it('rejects non-matching relative includes', async () => {
    const tmpdir = await generateFixture(
      'clang_rpc',
      new Map([['a/b.cpp', '#include <../../x.h>']]),
    );
    const file = await finder.getRelatedSourceForHeader(
      nuclideUri.join(tmpdir, 'x.h'),
      tmpdir,
    );
    expect(file).toBeFalsy();
  });

  it('returns null for invalid paths', async () => {
    const file = await finder.getRelatedSourceForHeader(
      '/this/is/not/a/path',
      '/lol',
    );
    expect(file).toBeFalsy();
  });

  it('caches results of finding source for header', async () => {
    const implSpy = jest.spyOn(finder, '_getRelatedSourceForHeaderImpl');
    const tmpdir = await generateFixture(
      'clang_rpc',
      new Map([['a/x.cpp', '#include <../x.h>']]),
    );
    const sourceFile = nuclideUri.join(tmpdir, 'a/x.cpp');
    // Call it a few times and make sure the underlying impl only ran once.
    const results = await Promise.all(
      Array.from(range(0, 10)).map(() =>
        finder.getRelatedSourceForHeader(
          nuclideUri.join(tmpdir, 'x.h'),
          tmpdir,
        ),
      ),
    );
    for (const file of results) {
      expect(file).toBe(sourceFile);
    }
    expect(implSpy.mock.calls.length).toBe(1);
  });
});
