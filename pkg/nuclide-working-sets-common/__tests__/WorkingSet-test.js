/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 * @emails oncall+nuclide
 */
import {WorkingSet} from '../lib/WorkingSet';

describe('WorkingSet', () => {
  describe('- Empty set', () => {
    it('contains any files', () => {
      const empty = new WorkingSet();
      expect(empty.containsFile('/')).toBe(true);
      expect(empty.containsFile('/aaa')).toBe(true);
      expect(empty.containsFile('/aaa/bbbb')).toBe(true);
      expect(empty.containsFile('nuclide://aaa.bbb/')).toBe(true);
      expect(empty.containsFile('nuclide://aaa.bbb/aaa')).toBe(true);
      expect(empty.containsFile('nuclide://aaa.bbb/aaa/bbb')).toBe(true);
    });

    it('contain any dir', () => {
      const empty = new WorkingSet();
      expect(empty.containsDir('/aaa')).toBe(true);
      expect(empty.containsDir('/aaa/bbbb')).toBe(true);
      expect(empty.containsDir('nuclide://aaa.bbb/')).toBe(true);
      expect(empty.containsDir('nuclide://aaa.bbb/aaa')).toBe(true);
      expect(empty.containsDir('nuclide://aaa.bbb/aaa/bbb')).toBe(true);
    });
  });

  describe('- Local root set', () => {
    it('contains every local file', () => {
      const root = new WorkingSet(['/']);
      expect(root.containsFile('/')).toBe(true);
      expect(root.containsFile('/aaa')).toBe(true);
      expect(root.containsFile('/aaa/bbbb')).toBe(true);
    });

    it('contains every local dir', () => {
      const root = new WorkingSet(['/']);
      expect(root.containsDir('/')).toBe(true);
      expect(root.containsDir('/aaa')).toBe(true);
      expect(root.containsDir('/aaa/bbbb')).toBe(true);
    });
  });

  describe('- Remote root set', () => {
    it('contains every remote file', () => {
      const root = new WorkingSet(['nuclide://aaa.bbb/']);
      expect(root.containsFile('nuclide://aaa.bbb/')).toBe(true);
      expect(root.containsFile('nuclide://aaa.bbb/aaa')).toBe(true);
      expect(root.containsFile('nuclide://aaa.bbb/aaa/bbb')).toBe(true);
    });

    it('contains every remote dir', () => {
      const root = new WorkingSet(['nuclide://aaa.bbb/']);
      expect(root.containsDir('nuclide://aaa.bbb/')).toBe(true);
      expect(root.containsDir('nuclide://aaa.bbb/aaa')).toBe(true);
      expect(root.containsDir('nuclide://aaa.bbb/aaa/bbb')).toBe(true);
    });
  });

  it('detects properly files and dirs included in the set', () => {
    const ws = new WorkingSet(['/aaa/bbb', '/aaa/ccc', '/ddd']);
    expect(ws.containsFile('/aaa/bbb/file.test')).toBe(true);
    expect(ws.containsFile('/aaa/ccc/file.test')).toBe(true);
    expect(ws.containsFile('/aaa/ddd/file.test')).toBe(false);
    expect(ws.containsFile('/ddd/file.test')).toBe(true);
    expect(ws.containsFile('/aaa/file.test')).toBe(false);
    expect(ws.containsFile('/file.test')).toBe(false);

    expect(ws.containsDir('/')).toBe(true);
    expect(ws.containsDir('/aaa')).toBe(true);
    expect(ws.containsDir('/aaa/bbb')).toBe(true);
    expect(ws.containsDir('/aaa/bbb/ccc')).toBe(true);
    expect(ws.containsDir('/aaa/ddd')).toBe(false);
    expect(ws.containsDir('/eee')).toBe(false);
  });

  it('shares across similar local and remote paths', () => {
    const local = new WorkingSet(['/aaa/bbb', '/aaa/ccc']);
    expect(local.containsFile('nuclide://some.host/')).toBe(false);
    expect(local.containsFile('nuclide://some.host/aaa')).toBe(false);

    expect(local.containsFile('nuclide://some.host/aaa/bbb')).toBe(true);
    expect(local.containsFile('nuclide://some.host/aaa/bbb/file.test')).toBe(
      true,
    );
    expect(local.containsFile('nuclide://some.host/aaa/ccc/file.test')).toBe(
      true,
    );

    expect(local.containsDir('nuclide://some.host/')).toBe(true);
    expect(local.containsDir('nuclide://some.host/aaa')).toBe(true);
    expect(local.containsDir('nuclide://some.host/aaa/bbb')).toBe(true);
    expect(local.containsDir('nuclide://some.host/aaa/bbb/ccc')).toBe(true);
  });

  it('shares across similar different hosts', () => {
    const remote = new WorkingSet([
      'nuclide://some.host/aaa/bbb',
      'nuclide://some.host/aaa/ccc',
    ]);
    expect(remote.containsFile('nuclide://other.host/')).toBe(false);
    expect(remote.containsFile('nuclide://other.host/aaa')).toBe(false);

    expect(remote.containsFile('nuclide://other.host/aaa/bbb')).toBe(true);
    expect(remote.containsFile('nuclide://other.host/aaa/bbb/file.test')).toBe(
      true,
    );
    expect(remote.containsFile('nuclide://other.host/aaa/ccc/file.test')).toBe(
      true,
    );

    expect(remote.containsDir('nuclide://other.host/')).toBe(true);
    expect(remote.containsDir('nuclide://other.host/aaa')).toBe(true);
    expect(remote.containsDir('nuclide://other.host/aaa/bbb')).toBe(true);
    expect(remote.containsDir('nuclide://other.host/aaa/bbb/ccc')).toBe(true);
  });

  it('handles removal of one of the URIs', () => {
    const local = new WorkingSet([
      '/aaa/bbb/ccc/ddd.txt',
      '/aaa/bbb/ccc/eee.txt',
    ]);

    const processed = local.remove('/aaa/bbb/ccc/eee.txt');
    const processedUris = processed.getUris();
    expect(processedUris.length).toBe(1);
    expect(processedUris[0]).toBe('/aaa/bbb/ccc/ddd.txt');
  });

  it('tests by split path properly', () => {
    const mix = new WorkingSet(['/aaa/bbb', 'nuclide://some.host/ccc/ddd']);
    expect(mix.containsFileBySplitPath(['/'])).toBe(false);
    expect(mix.containsFileBySplitPath(['/', 'aaa'])).toBe(false);
    expect(mix.containsFileBySplitPath(['/', 'aaa', 'bbb'])).toBe(true);
    expect(mix.containsFileBySplitPath(['/', 'aaa', 'bbb', 'ccc'])).toBe(true);

    expect(mix.containsFileBySplitPath(['nuclide://some.host/'])).toBe(false);
    expect(mix.containsFileBySplitPath(['nuclide://some.host/', 'ccc'])).toBe(
      false,
    );
    expect(
      mix.containsFileBySplitPath(['nuclide://some.host/', 'ccc', 'ddd']),
    ).toBe(true);
    expect(
      mix.containsFileBySplitPath([
        'nuclide://some.host/',
        'ccc',
        'ddd',
        'eee',
      ]),
    ).toBe(true);

    expect(mix.containsDirBySplitPath(['/'])).toBe(true);
    expect(mix.containsDirBySplitPath(['/', 'aaa'])).toBe(true);
    expect(mix.containsDirBySplitPath(['/', 'zzz'])).toBe(false);
    expect(mix.containsDirBySplitPath(['/', 'aaa', 'bbb'])).toBe(true);
    expect(mix.containsDirBySplitPath(['/', 'aaa', 'bbb', 'ccc'])).toBe(true);

    expect(mix.containsDirBySplitPath(['nuclide://some.host/'])).toBe(true);
    expect(mix.containsDirBySplitPath(['nuclide://some.host/', 'ccc'])).toBe(
      true,
    );
    expect(mix.containsDirBySplitPath(['nuclide://some.host/', 'zzz'])).toBe(
      false,
    );
    expect(
      mix.containsDirBySplitPath(['nuclide://some.host/', 'ccc', 'ddd']),
    ).toBe(true);
    expect(
      mix.containsDirBySplitPath(['nuclide://some.host/', 'ccc', 'ddd', 'eee']),
    ).toBe(true);
  });
});
