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

import JumpToRelatedFile from '../lib/JumpToRelatedFile';
import RelatedFileFinder from '../lib/RelatedFileFinder';

describe('JumpToRelatedFile', () => {
  const relatedFiles = ['dir/Test.h', 'dir/Test.m', 'dir/TestInternal.h'];
  let currentFile = '';

  beforeEach(() => {
    spyOn(RelatedFileFinder, 'find').andCallFake(() => {
      return {relatedFiles, index: relatedFiles.indexOf(currentFile)};
    });
  });

  describe('@getNextRelatedFile_', () => {
    it('gets next related file at the start of the sequence', () => {
      waitsForPromise(async () => {
        currentFile = 'dir/Test.h';

        const jumpToRelatedFile = new JumpToRelatedFile();
        expect(await jumpToRelatedFile.getNextRelatedFile(currentFile)).toEqual(
          'dir/TestInternal.h',
        );
      });
    });

    it('gets next related file in the middle of the sequence', () => {
      waitsForPromise(async () => {
        currentFile = 'dir/Test.m';

        const jumpToRelatedFile = new JumpToRelatedFile();
        expect(await jumpToRelatedFile.getNextRelatedFile(currentFile)).toEqual(
          'dir/Test.h',
        );
      });
    });

    it('gets next related file at the end of the sequence', () => {
      waitsForPromise(async () => {
        currentFile = 'dir/TestInternal.h';

        const jumpToRelatedFile = new JumpToRelatedFile();
        expect(await jumpToRelatedFile.getNextRelatedFile(currentFile)).toEqual(
          'dir/Test.m',
        );
      });
    });
  });

  describe('@getPreviousRelatedFile_', () => {
    it('gets previous related file at the start of the sequence', () => {
      waitsForPromise(async () => {
        currentFile = 'dir/Test.h';

        const jumpToRelatedFile = new JumpToRelatedFile();
        expect(
          await jumpToRelatedFile.getPreviousRelatedFile(currentFile),
        ).toEqual('dir/Test.m');
      });
    });

    it('gets previous related file in the middle of the sequence', () => {
      waitsForPromise(async () => {
        currentFile = 'dir/Test.m';

        const jumpToRelatedFile = new JumpToRelatedFile();
        expect(
          await jumpToRelatedFile.getPreviousRelatedFile(currentFile),
        ).toEqual('dir/TestInternal.h');
      });
    });

    it('gets previous related file at the end of the sequence', () => {
      waitsForPromise(async () => {
        currentFile = 'dir/TestInternal.h';

        const jumpToRelatedFile = new JumpToRelatedFile();
        expect(
          await jumpToRelatedFile.getPreviousRelatedFile(currentFile),
        ).toEqual('dir/Test.h');
      });
    });

    it('does nothing for missing files', () => {
      waitsForPromise(async () => {
        currentFile = 'dir/Test.h~';

        const jumpToRelatedFile = new JumpToRelatedFile();
        expect(
          await jumpToRelatedFile.getPreviousRelatedFile(currentFile),
        ).toEqual('dir/Test.h~');
      });
    });
  });
});
