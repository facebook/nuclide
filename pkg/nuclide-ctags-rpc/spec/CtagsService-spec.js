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

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';

import {getCtagsService, CtagsService} from '..';

const TAGS_PATH = nuclideUri.join(__dirname, 'fixtures', 'tags');

describe('getCtagsService', () => {
  it('can find the tags file from a path', () => {
    waitsForPromise(async () => {
      const filePath = nuclideUri.join(__dirname, 'fixtures', 'a.cpp');
      const svc = await getCtagsService(filePath);
      invariant(svc);
      expect(await svc.getTagsPath()).toBe(
        nuclideUri.join(__dirname, 'fixtures', 'tags'),
      );
    });
  });

  it('returns null when no tags file exists', () => {
    waitsForPromise(async () => {
      const filePath = '/!@#$%^&/test';
      const svc = await getCtagsService(filePath);
      expect(svc).toBe(null);
    });
  });
});

describe('CtagsService.findTags', () => {
  it('can read a tags file', () => {
    waitsForPromise(async () => {
      const svc = new CtagsService(TAGS_PATH);
      let tags = await svc.findTags('a');
      expect(tags).toEqual([
        {
          name: 'a',
          file: nuclideUri.join(__dirname, 'fixtures', 'a.cpp'),
          lineNumber: 0,
          kind: '',
          pattern: '/^void a() {$/',
        },
      ]);

      tags = await svc.findTags('b');
      expect(tags).toEqual([
        {
          name: 'b',
          file: nuclideUri.join(__dirname, 'fixtures', 'b.cpp'),
          lineNumber: 0,
          kind: 'f',
          pattern: '/^void b() {$/',
          fields: new Map([['namespace', 'test']]),
        },
      ]);
    });
  });

  it('ignores missing files', () => {
    waitsForPromise(async () => {
      const svc = new CtagsService(TAGS_PATH);
      const tags = await svc.findTags('c');
      // A tag for `c` exists, but the file has been deliberately removed.
      expect(tags).toEqual([]);
    });
  });

  it('respects the given limit', () => {
    waitsForPromise(async () => {
      const svc = new CtagsService(TAGS_PATH);
      const tags = await svc.findTags('', {partialMatch: true, limit: 1});
      expect(tags).toEqual([
        {
          name: 'a',
          file: nuclideUri.join(__dirname, 'fixtures', 'a.cpp'),
          lineNumber: 0,
          kind: '',
          pattern: '/^void a() {$/',
        },
      ]);
    });
  });
});
