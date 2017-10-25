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
import {HgService} from '../lib/HgService';
import {
  AmendMode,
  StatusCodeId,
  MergeConflictStatus,
} from '../lib/hg-constants';
import invariant from 'assert';
import {Observable} from 'rxjs';
import {CommandServer} from '../../nuclide-remote-atom-rpc/lib/CommandServer';

const mockOutput = `
[
{
  "command":"rebase",
  "conflicts":[
    {
       "base":{
          "contents": "",
          "exists":true,
          "isexec":false,
          "issymlink":false
       },
       "local":{
          "contents": "t1",
          "exists":true,
          "isexec":false,
          "issymlink":false
       },
       "other":{
          "contents":"t2",
          "exists":true,
          "isexec":false,
          "issymlink":false
       },
       "output":{
          "contents": "\u003c\u003c\u003c\u003c\u003c\u003c\u003c dest:   aeef989d24c2 - asriram: t1\\nt1\\n=======\\nt2\\n\u003e\u003e\u003e\u003e\u003e\u003e\u003e source: 64c253f3c1d7 - asriram: t2\\n",
          "exists":true,
          "isexec":false,
          "issymlink":false,
          "path":"temp1"
       },
       "path":"temp1"
    },
    {
       "base":{
          "contents": "",
          "exists":false,
          "isexec":false,
          "issymlink":false
       },
       "local":{
          "contents": "t1",
          "exists":false,
          "isexec":false,
          "issymlink":false
       },
       "other":{
          "contents":"t2",
          "exists":true,
          "isexec":false,
          "issymlink":false
       },
       "output":{
          "contents": "\u003c\u003c\u003c\u003c\u003c\u003c\u003c dest:   aeef989d24c2 - asriram: t1\\nt1\\n=======\\nt2\\n\u003e\u003e\u003e\u003e\u003e\u003e\u003e source: 64c253f3c1d7 - asriram: t2\\n",
          "exists":true,
          "isexec":false,
          "issymlink":false,
          "path":"temp2"
       },
       "path":"temp2"
    }
  ]
}
]`;

class TestHgService extends HgService {
  // These tests target the non-watchman-dependent features of LocalHgService.
  _subscribeToWatchman(): Promise<void> {
    return Promise.resolve();
  }
}

describe('HgService', () => {
  let hgService;
  const TEST_WORKING_DIRECTORY = '/Test/Working/Directory/';
  const PATH_1 = nuclideUri.join(TEST_WORKING_DIRECTORY, 'test1.js');
  const PATH_2 = nuclideUri.join(TEST_WORKING_DIRECTORY, 'test2.js');
  function relativize(filePath: string): string {
    return nuclideUri.relative(TEST_WORKING_DIRECTORY, filePath);
  }

  beforeEach(() => {
    hgService = new TestHgService(TEST_WORKING_DIRECTORY);
  });

  describe('::createBookmark', () => {
    const BOOKMARK_NAME = 'fakey456';
    const BASE_REVISION = 'fakey123';

    it('calls the appropriate `hg` command to add', () => {
      waitsForPromise(async () => {
        spyOn(hgService, '_hgAsyncExecute');
        await hgService.createBookmark(BOOKMARK_NAME);
        expect(hgService._hgAsyncExecute).toHaveBeenCalledWith(
          ['bookmark', BOOKMARK_NAME],
          {cwd: TEST_WORKING_DIRECTORY},
        );
      });
    });

    it('calls the appropriate `hg` command to add with base revision', () => {
      waitsForPromise(async () => {
        spyOn(hgService, '_hgAsyncExecute');
        await hgService.createBookmark(BOOKMARK_NAME, BASE_REVISION);
        expect(hgService._hgAsyncExecute).toHaveBeenCalledWith(
          ['bookmark', '--rev', BASE_REVISION, BOOKMARK_NAME],
          {cwd: TEST_WORKING_DIRECTORY},
        );
      });
    });
  });

  describe('::deleteBookmark', () => {
    const BOOKMARK_NAME = 'fakey456';

    it('calls the appropriate `hg` command to delete', () => {
      waitsForPromise(async () => {
        spyOn(hgService, '_hgAsyncExecute');
        await hgService.deleteBookmark(BOOKMARK_NAME);
        expect(hgService._hgAsyncExecute).toHaveBeenCalledWith(
          ['bookmarks', '--delete', BOOKMARK_NAME],
          {cwd: TEST_WORKING_DIRECTORY},
        );
      });
    });
  });

  describe('::renameBookmark', () => {
    const BOOKMARK_NAME = 'fakey456';

    it('calls the appropriate `hg` command to rename', () => {
      waitsForPromise(async () => {
        spyOn(hgService, '_hgAsyncExecute');
        await hgService.renameBookmark(BOOKMARK_NAME, 'fried-chicken');
        expect(hgService._hgAsyncExecute).toHaveBeenCalledWith(
          ['bookmarks', '--rename', BOOKMARK_NAME, 'fried-chicken'],
          {cwd: TEST_WORKING_DIRECTORY},
        );
      });
    });
  });

  describe('::fetchDiffInfo', () => {
    const mockHgDiffOutput = `diff --git test-test/blah/blah.js test-test/blah/blah.js
    --- test1.js
    +++ test1.js
    @@ -150,1 +150,2 @@
    -hi
    +
    +asdfdf`;

    const expectedDiffInfo = {
      added: 2,
      deleted: 1,
      lineDiffs: [
        {
          oldStart: 150,
          oldLines: 1,
          newStart: 150,
          newLines: 2,
        },
      ],
    };

    it('fetches the unified diff output for the given path.', () => {
      // Test set up: mock out dependency on hg.
      invariant(hgService);
      spyOn(hgService, '_hgAsyncExecute').andCallFake((args, options) => {
        expect(args.pop()).toBe(PATH_1);
        return Promise.resolve({stdout: mockHgDiffOutput});
      });

      waitsForPromise(async () => {
        invariant(hgService);
        const pathToDiffInfo = await hgService.fetchDiffInfo([PATH_1]);
        invariant(pathToDiffInfo);
        expect(pathToDiffInfo.size).toBe(1);
        expect(pathToDiffInfo.get(PATH_1)).toEqual(expectedDiffInfo);
      });
    });
  });

  describe('::getConfigValueAsync', () => {
    it('calls `hg config` with the passed key', () => {
      spyOn(hgService, '_hgAsyncExecute').andCallFake((args, options) => {
        expect(args).toEqual(['config', 'committemplate.emptymsg']);
        // Return the Object shape expected by `HgServiceBase`.
        return {stdout: ''};
      });
      waitsForPromise(async () => {
        await hgService.getConfigValueAsync('committemplate.emptymsg');
      });
    });

    it('returns `null` on errors', () => {
      spyOn(hgService, '_hgAsyncExecute').andThrow(
        new Error('Something failed'),
      );
      waitsForPromise(async () => {
        const config = await hgService.getConfigValueAsync(
          'non.existent.config',
        );
        expect(config).toBeNull();
      });
    });
  });

  describe('::fetchBookmarks', () => {
    const mockHgBookmarksOutput = `
[
  {
    "active": true,
    "bookmark": "foobar",
    "node": "cc6608797c69d782ba26a0843795ef3118efcb2f",
    "rev": 12345
  }
]`;

    it('fetches bookmarks', () => {
      let wasCalled = false;
      spyOn(hgService, '_hgRunCommand').andCallFake((args, options) => {
        expect(args.length).toBe(2);
        expect(args.pop()).toBe('-Tjson');
        expect(args.pop()).toBe('bookmarks');
        wasCalled = true;
        return Observable.of(mockHgBookmarksOutput);
      });
      waitsForPromise(async () => {
        await hgService
          .fetchBookmarks()
          .refCount()
          .toPromise();
        expect(wasCalled).toBeTruthy();
      });
    });
  });

  describe('::rename', () => {
    it('can rename files', () => {
      let wasCalled = false;
      spyOn(hgService, '_hgAsyncExecute').andCallFake((args, options) => {
        expect(args.length).toBe(3);
        expect(args.pop()).toBe('file_2.txt');
        expect(args.pop()).toBe('file_1.txt');
        expect(args.pop()).toBe('rename');
        wasCalled = true;
      });
      waitsForPromise(async () => {
        await hgService.rename(['file_1.txt'], 'file_2.txt');
        expect(wasCalled).toBeTruthy();
      });
    });
  });

  describe('::remove', () => {
    it('can remove files', () => {
      let wasCalled = false;
      spyOn(hgService, '_hgAsyncExecute').andCallFake((args, options) => {
        expect(args.length).toBe(3);
        expect(args.pop()).toBe('file.txt');
        expect(args.pop()).toBe('-f');
        expect(args.pop()).toBe('remove');
        wasCalled = true;
      });
      waitsForPromise(async () => {
        await hgService.remove(['file.txt']);
        expect(wasCalled).toBeTruthy();
      });
    });
  });

  describe('::add', () => {
    it('can add files', () => {
      let wasCalled = false;
      spyOn(hgService, '_hgAsyncExecute').andCallFake((args, options) => {
        expect(args.length).toBe(2);
        expect(args.pop()).toBe('file.txt');
        expect(args.pop()).toBe('add');
        wasCalled = true;
      });
      waitsForPromise(async () => {
        await hgService.add(['file.txt']);
        expect(wasCalled).toBeTruthy();
      });
    });
  });

  describe('::commit|amend', () => {
    const commitMessage = 'foo\n\nbar\nbaz';
    const processMessage = {
      kind: 'stdout',
      data: 'Fake message for testing',
    };
    let committedToHg = false;
    let expectedArgs = null;
    beforeEach(() => {
      expectedArgs = null;
      committedToHg = false;
      spyOn(hgService, '_hgObserveExecution').andCallFake((_args, options) => {
        const args = _args;
        expect(expectedArgs).not.toBeNull();
        // eslint-disable-next-line eqeqeq
        invariant(expectedArgs !== null);
        expect(args.length).toBe(
          expectedArgs.length,
          `\nExpected args: [${expectedArgs.toString()}]\nActual args: [${args.toString()}]`,
        );
        while (args.length > 0) {
          const expectedArg = expectedArgs.pop();
          expect(args.pop()).toBe(expectedArg);
        }
        committedToHg = true;
        return Observable.of(processMessage);
      });
      CommandServer._server = ({
        getAddress: () => ({family: 'f', port: 12345}),
      }: any);
      CommandServer._connections = [({}: any)];
    });

    describe('::commit', () => {
      it('can commit changes', () => {
        expectedArgs = [
          'commit',
          '--config',
          'ui.merge=:merge',
          '-m',
          commitMessage,
        ];
        waitsForPromise(async () => {
          await hgService
            .commit(commitMessage)
            .refCount()
            .toArray()
            .toPromise();
          expect(committedToHg).toBeTruthy('Looks like commit did not happen');
        });
      });
    });

    describe('::amend', () => {
      it('can amend changes with a message', () => {
        expectedArgs = [
          'amend',
          '--config',
          'ui.merge=:merge',
          '-m',
          commitMessage,
        ];
        waitsForPromise(async () => {
          await hgService
            .amend(commitMessage, AmendMode.CLEAN)
            .refCount()
            .toArray()
            .toPromise();
          expect(committedToHg).toBeTruthy('Looks like commit did not happen');
        });
      });

      it('can amend changes without a message', () => {
        expectedArgs = ['amend', '--config', 'ui.merge=:merge'];
        waitsForPromise(async () => {
          await hgService
            .amend(null, AmendMode.CLEAN)
            .refCount()
            .toArray()
            .toPromise();
          expect(committedToHg).toBeTruthy('Looks like commit did not happen');
        });
      });

      it('can amend with --rebase & a commit message', () => {
        expectedArgs = [
          'amend',
          '--rebase',
          '--config',
          'ui.merge=:merge',
          '-m',
          commitMessage,
        ];
        waitsForPromise(async () => {
          await hgService
            .amend(commitMessage, AmendMode.REBASE)
            .refCount()
            .toArray()
            .toPromise();
          expect(committedToHg).toBeTruthy('Looks like commit did not happen');
        });
      });

      it('can amend with --fixup', () => {
        expectedArgs = ['amend', '--fixup', '--config', 'ui.merge=:merge'];
        waitsForPromise(async () => {
          await hgService
            .amend(null, AmendMode.FIXUP)
            .refCount()
            .toArray()
            .toPromise();
          expect(committedToHg).toBeTruthy('Looks like commit did not happen');
        });
      });
    });
  });

  describe('::fetchMergeConflicts', () => {
    it('fetches rich merge conflict data', () => {
      let wasCalled = false;
      spyOn(hgService, '_hgRunCommand').andCallFake((args, options) => {
        wasCalled = true;
        return Observable.of(mockOutput);
      });
      waitsForPromise(async () => {
        const mergeConflictsEnriched = await hgService
          .fetchMergeConflicts()
          .refCount()
          .toPromise();
        expect(wasCalled).toBeTruthy();
        expect(mergeConflictsEnriched).not.toBeNull();
        invariant(mergeConflictsEnriched != null);
        expect(mergeConflictsEnriched.conflicts.length).toBe(2);
        const conflicts = mergeConflictsEnriched.conflicts;
        expect(conflicts[0].status).toBe(MergeConflictStatus.BOTH_CHANGED);
        expect(conflicts[1].status).toBe(MergeConflictStatus.DELETED_IN_OURS);
      });
    });
  });

  describe('::fetchMergeConflicts()', () => {
    const relativePath1 = relativize(PATH_1);
    const relativePath2 = relativize(PATH_2);

    beforeEach(() => {
      spyOn(hgService, '_hgRunCommand').andReturn({
        stdout: JSON.stringify([
          {path: relativePath1, status: StatusCodeId.UNRESOLVED},
          {path: relativePath2, status: StatusCodeId.UNRESOLVED},
          {path: '/abc', status: 'something'},
        ]),
      });
    });
  });

  describe('::resolveConflictedFile()', () => {
    beforeEach(() => {
      spyOn(hgService, '_hgObserveExecution').andCallFake(path => {
        return Observable.empty();
      });
    });

    it('calls hg resolve', () => {
      waitsForPromise(async () => {
        await hgService
          .markConflictedFile(PATH_1, /* resolved */ true)
          .refCount()
          .toArray()
          .toPromise();
        expect(hgService._hgObserveExecution).toHaveBeenCalledWith(
          ['resolve', '-m', PATH_1],
          {cwd: TEST_WORKING_DIRECTORY},
        );
      });
    });
  });

  describe('::_checkConflictChange', () => {
    let mergeConflicts;
    let mergeDirectoryExists;

    beforeEach(() => {
      mergeDirectoryExists = false;
      mergeConflicts = null;
      spyOn(hgService, '_checkMergeDirectoryExists').andCallFake(() => {
        return mergeDirectoryExists;
      });
      spyOn(hgService, '_fetchMergeConflicts').andCallFake(
        () => mergeConflicts,
      );
    });

    it("reports no conflicts when the merge directory isn't there", () => {
      waitsForPromise(async () => {
        mergeDirectoryExists = false;
        await hgService._checkConflictChange();
        expect(hgService._isInConflict).toBeFalsy();
      });
    });

    it('reports no conflicts even when merge directory exists, but no conflicts found', () => {
      mergeDirectoryExists = true;
      waitsForPromise(async () => {
        await hgService._checkConflictChange();
        expect(hgService._isInConflict).toBeFalsy();
      });
    });

    it('reports conflicts when merge directory exists + conflicts found', () => {
      mergeDirectoryExists = true;
      mergeConflicts = mockOutput;
      waitsForPromise(async () => {
        await hgService._checkConflictChange();
        expect(hgService._isInConflict).toBeTruthy();
      });
    });

    it('exits of conflict state when the merge directory is removed', () => {
      mergeDirectoryExists = true;
      mergeConflicts = mockOutput;
      waitsForPromise(async () => {
        await hgService._checkConflictChange();
        expect(hgService._isInConflict).toBeTruthy();
        mergeDirectoryExists = false;
        await hgService._checkConflictChange();
        expect(hgService._isInConflict).toBeFalsy();
      });
    });
  });

  describe('::destroy', () => {
    it('should do cleanup without throwing an exception.', () => {
      hgService && hgService.dispose();
    });
  });
});
