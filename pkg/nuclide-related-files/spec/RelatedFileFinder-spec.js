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

import RelatedFileFinder from '../lib/RelatedFileFinder';

function mockFiles(files: Array<string>) {
  spyOn(
    require('../../nuclide-remote-connection'),
    'getFileSystemServiceByNuclideUri',
  ).andReturn({
    readdir: async () => {
      return files.map(name => {
        return [name, true, false];
      });
    },
  });
}

describe('RelatedFileFinder', () => {
  describe('@find', () => {
    it('finds related file with a different extension', () => {
      waitsForPromise(async () => {
        mockFiles(['Test.h', 'Test.m', 'Test.m~']);
        expect(await RelatedFileFinder.find('dir/Test.m')).toEqual({
          relatedFiles: ['dir/Test.h', 'dir/Test.m'],
          index: 1,
        });
      });
    });

    it('finds related file whose name ends with `Internal`', () => {
      waitsForPromise(async () => {
        mockFiles(['Test.m', 'TestInternal.h']);
        expect(await RelatedFileFinder.find('dir/Test.m')).toEqual({
          relatedFiles: ['dir/Test.m', 'dir/TestInternal.h'],
          index: 0,
        });
      });
    });

    it('finds related file whose name ends with `-inl`', () => {
      waitsForPromise(async () => {
        mockFiles(['Test.h', 'Test-inl.h']);
        expect(await RelatedFileFinder.find('dir/Test.h')).toEqual({
          relatedFiles: ['dir/Test-inl.h', 'dir/Test.h'],
          index: 1,
        });
      });
    });

    it('does not find related file whose name starts with `Internal`', () => {
      waitsForPromise(async () => {
        mockFiles(['Test.m', 'InternalTest.h']);
        expect(await RelatedFileFinder.find('dir/Test.m')).toEqual({
          relatedFiles: ['dir/Test.m'],
          index: 0,
        });
      });
    });

    it('finds related file whose name ends with `t` and itself', () => {
      waitsForPromise(async () => {
        mockFiles(['Test.m', 'Test.v', 'Test.t']);
        expect(
          await RelatedFileFinder.find('dir/Test.m', new Set(['.t'])),
        ).toEqual({
          relatedFiles: ['dir/Test.m', 'dir/Test.t'],
          index: 0,
        });
      });
    });

    it('finds related file but nothing and then return all', () => {
      waitsForPromise(async () => {
        mockFiles(['Test.m', 'Test.v', 'Test.t']);
        expect(
          await RelatedFileFinder.find('dir/Test.m', new Set(['.o'])),
        ).toEqual({
          relatedFiles: ['dir/Test.m', 'dir/Test.t', 'dir/Test.v'],
          index: 0,
        });
      });
    });

    it('finds related file but only itself', () => {
      waitsForPromise(async () => {
        mockFiles(['Test.m', 'Test.v', 'Test.t']);
        expect(
          await RelatedFileFinder.find('dir/Test.m', new Set(['.m'])),
        ).toEqual({
          relatedFiles: ['dir/Test.m'],
          index: 0,
        });
      });
    });

    it('finds related file from a provider', () => {
      waitsForPromise(async () => {
        RelatedFileFinder.registerRelatedFilesProvider({
          getRelatedFiles(path: string): Promise<Array<string>> {
            return Promise.resolve(['dir/Related.h']);
          },
        });
        mockFiles(['Test.m', 'Related.h', 'Test.h']);
        expect(await RelatedFileFinder.find('dir/Test.m')).toEqual({
          relatedFiles: ['dir/Related.h', 'dir/Test.h', 'dir/Test.m'],
          index: 2,
        });
      });
    });
  });
});
