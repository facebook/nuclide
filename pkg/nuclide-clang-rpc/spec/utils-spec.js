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

import nuclideUri from 'nuclide-commons/nuclideUri';
import {generateFixture} from '../../nuclide-test-helpers';

import {findIncludingSourceFile} from '../lib/utils';

describe('findIncludingSourceFile', () => {
  it('is able to find an absolute include', () => {
    waitsForPromise(async () => {
      const tmpdir = await generateFixture(
        'clang_rpc',
        new Map([['a/b.cpp', '#include <a/b.h>']]),
      );
      const sourceFile = nuclideUri.join(tmpdir, 'a/b.cpp');
      const file = await findIncludingSourceFile(
        nuclideUri.join(tmpdir, 'a/b.h'),
        tmpdir,
      ).toPromise();
      expect(file).toBe(sourceFile);
    });
  });

  it('is able to find a relative include', () => {
    waitsForPromise(async () => {
      const tmpdir = await generateFixture(
        'clang_rpc',
        new Map([['a/x.cpp', '#include <../x.h>']]),
      );
      const sourceFile = nuclideUri.join(tmpdir, 'a/x.cpp');
      const file = await findIncludingSourceFile(
        nuclideUri.join(tmpdir, 'x.h'),
        tmpdir,
      ).toPromise();
      expect(file).toBe(sourceFile);
    });
  });

  it('rejects non-matching relative includes', () => {
    waitsForPromise(async () => {
      const tmpdir = await generateFixture(
        'clang_rpc',
        new Map([['a/b.cpp', '#include <../../x.h>']]),
      );
      const file = await findIncludingSourceFile(
        nuclideUri.join(tmpdir, 'x.h'),
        tmpdir,
      ).toPromise();
      expect(file).toBeNull();
    });
  });

  it('returns null for invalid paths', () => {
    waitsForPromise(async () => {
      const file = await findIncludingSourceFile(
        '/this/is/not/a/path',
        '/',
      ).toPromise();
      expect(file).toBeNull();
    });
  });
});
