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

import type {HgService as HgServiceType} from '../../nuclide-hg-rpc/lib/HgService';

import {Directory} from 'atom';
import {HgRepositoryClient} from '../lib/HgRepositoryClient';
import MockHgService from '../../nuclide-hg-rpc/spec/MockHgService';
import {StatusCodeNumber} from '../../nuclide-hg-rpc/lib/hg-constants';
import nuclideUri from 'nuclide-commons/nuclideUri';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {Observable} from 'rxjs';
import temp from 'temp';

temp.track();

describe('HgRepositoryClient', () => {
  const tempDir = temp.mkdirSync('testproj');
  const tempSubDir = temp.mkdirSync({dir: tempDir});

  const repoPath = nuclideUri.join(tempDir, '.hg');
  const workingDirectory = new Directory(tempDir);
  const projectDirectory = new Directory(tempSubDir);
  const repoOptions = {
    originURL: 'http://test.com/testproj',
    workingDirectory,
    projectRootDirectory: projectDirectory,
  };

  // Manufactures the absolute path of a file that should pass as being
  // within the repo.
  const createFilePath = filename => {
    return nuclideUri.join(projectDirectory.getPath(), filename);
  };

  // Some test "absolute" paths.
  const PATH_1 = createFilePath('test1.js');
  const PATH_2 = createFilePath('test2.js');
  const PATH_3 = createFilePath('test3.js');
  const PATH_4 = createFilePath('test4.js');
  const PATH_5 = createFilePath('test5.js');
  const PATH_6 = createFilePath('test6.js');
  const PATH_7 = createFilePath('test7.js');
  const PATH_CALLED_NULL = createFilePath('null');
  const PATH_CALLED_UNDEFINED = createFilePath('undefined');

  let mockHgService: HgServiceType = (null: any);
  let repo: HgRepositoryClient = (null: any);

  beforeEach(() => {
    mockHgService = ((new MockHgService(): any): HgServiceType);
    repo = new HgRepositoryClient(repoPath, mockHgService, repoOptions);
  });

  describe('::getType()', () => {
    it('returns "hg"', () => {
      expect(repo.getType()).toBe('hg');
    });
  });

  describe('::getProjectDirectory', () => {
    it(
      'returns the path of the root project folder in Atom that this Client provides information' +
        ' about.',
      () => {
        expect(repo.getProjectDirectory()).toBe(projectDirectory.getPath());
      },
    );
  });

  describe('::isPathIgnored', () => {
    it('returns true if the path is marked ignored in the cache.', () => {
      // Force the state of the cache.
      repo._hgStatusCache = new Map([[PATH_1, StatusCodeNumber.IGNORED]]);
      expect(repo.isPathIgnored(PATH_1)).toBe(true);
    });

    it('returns true if the path is, or is within, the .hg directory.', () => {
      expect(repo.isPathIgnored(repoPath)).toBe(true);
      expect(repo.isPathIgnored(nuclideUri.join(repoPath, 'blah'))).toBe(true);
    });

    it('returns false if the path is not in the cache and is not the .hg directory.', () => {
      expect(repo.isPathIgnored('/A/Random/Path')).toBe(false);
      const parsedPath = nuclideUri.parsePath(repoPath);
      expect(repo.isPathIgnored(parsedPath.root)).toBe(false);
      expect(repo.isPathIgnored(parsedPath.dir)).toBe(false);
    });

    it(
      'returns false if the path is null or undefined, but handles files with those' +
        ' names.',
      () => {
        // Force the state of the cache.
        repo._hgStatusCache = new Map([
          [PATH_CALLED_NULL, StatusCodeNumber.IGNORED],
          [PATH_CALLED_UNDEFINED, StatusCodeNumber.IGNORED],
        ]);
        expect(repo.isPathIgnored(null)).toBe(false);
        expect(repo.isPathIgnored(undefined)).toBe(false);
        expect(repo.isPathIgnored(PATH_CALLED_NULL)).toBe(true);
        expect(repo.isPathIgnored(PATH_CALLED_UNDEFINED)).toBe(true);
      },
    );
  });

  describe('::isPathNew', () => {
    it(
      'returns false if the path is null or undefined, but handles files with those' +
        ' names.',
      () => {
        // Force the state of the cache.
        repo._hgStatusCache = new Map([
          [PATH_CALLED_NULL, StatusCodeNumber.ADDED],
          [PATH_CALLED_UNDEFINED, StatusCodeNumber.ADDED],
        ]);
        expect(repo.isPathNew(null)).toBe(false);
        expect(repo.isPathNew(undefined)).toBe(false);
        expect(repo.isPathNew(PATH_CALLED_NULL)).toBe(true);
        expect(repo.isPathNew(PATH_CALLED_UNDEFINED)).toBe(true);
      },
    );
  });

  describe('::isPathModified', () => {
    it(
      'returns false if the path is null or undefined, but handles files with those' +
        ' names.',
      () => {
        // Force the state of the cache.
        repo._hgStatusCache = new Map([
          [PATH_CALLED_NULL, StatusCodeNumber.MODIFIED],
          [PATH_CALLED_UNDEFINED, StatusCodeNumber.MODIFIED],
        ]);
        expect(repo.isPathModified(null)).toBe(false);
        expect(repo.isPathModified(undefined)).toBe(false);
        expect(repo.isPathModified(PATH_CALLED_NULL)).toBe(true);
        expect(repo.isPathModified(PATH_CALLED_UNDEFINED)).toBe(true);
      },
    );
  });

  describe('::isPathAdded', () => {
    it(
      'returns false if the path is null, untracked, modified or deleted' +
        ' names.',
      () => {
        // Force the state of the cache.
        repo._hgStatusCache = new Map([
          [PATH_CALLED_NULL, StatusCodeNumber.ADDED],
          [PATH_CALLED_UNDEFINED, StatusCodeNumber.ADDED],
          [PATH_1, StatusCodeNumber.ADDED],
          [PATH_2, StatusCodeNumber.CLEAN],
          [PATH_3, StatusCodeNumber.IGNORED],
          [PATH_4, StatusCodeNumber.MISSING],
          [PATH_5, StatusCodeNumber.MODIFIED],
          [PATH_6, StatusCodeNumber.REMOVED],
          [PATH_7, StatusCodeNumber.UNTRACKED],
        ]);
        expect(repo.isPathAdded(null)).toBe(false);
        expect(repo.isPathAdded(undefined)).toBe(false);
        expect(repo.isPathAdded(PATH_CALLED_NULL)).toBe(true);
        expect(repo.isPathAdded(PATH_CALLED_UNDEFINED)).toBe(true);
        expect(repo.isPathAdded(PATH_1)).toBe(true);
        expect(repo.isPathAdded(PATH_2)).toBe(false);
        expect(repo.isPathAdded(PATH_3)).toBe(false);
        expect(repo.isPathAdded(PATH_4)).toBe(false);
        expect(repo.isPathAdded(PATH_5)).toBe(false);
        expect(repo.isPathAdded(PATH_6)).toBe(false);
        expect(repo.isPathAdded(PATH_7)).toBe(false);
      },
    );
  });

  describe('::isPathUntracked', () => {
    it(
      'returns false if the path is null, untracked, modified or deleted' +
        ' names.',
      () => {
        // Force the state of the cache.
        repo._hgStatusCache = new Map([
          [PATH_CALLED_NULL, StatusCodeNumber.UNTRACKED],
          [PATH_CALLED_UNDEFINED, StatusCodeNumber.UNTRACKED],
          [PATH_1, StatusCodeNumber.UNTRACKED],
          [PATH_2, StatusCodeNumber.CLEAN],
          [PATH_3, StatusCodeNumber.IGNORED],
          [PATH_4, StatusCodeNumber.MISSING],
          [PATH_5, StatusCodeNumber.MODIFIED],
          [PATH_6, StatusCodeNumber.REMOVED],
          [PATH_7, StatusCodeNumber.ADDED],
        ]);
        expect(repo.isPathUntracked(null)).toBe(false);
        expect(repo.isPathUntracked(undefined)).toBe(false);
        expect(repo.isPathUntracked(PATH_CALLED_NULL)).toBe(true);
        expect(repo.isPathUntracked(PATH_CALLED_UNDEFINED)).toBe(true);
        expect(repo.isPathUntracked(PATH_1)).toBe(true);
        expect(repo.isPathUntracked(PATH_2)).toBe(false);
        expect(repo.isPathUntracked(PATH_3)).toBe(false);
        expect(repo.isPathUntracked(PATH_4)).toBe(false);
        expect(repo.isPathUntracked(PATH_5)).toBe(false);
        expect(repo.isPathUntracked(PATH_6)).toBe(false);
        expect(repo.isPathUntracked(PATH_7)).toBe(false);
      },
    );
  });

  describe('::getCachedPathStatus', () => {
    beforeEach(() => {
      repo._hgStatusCache = new Map([
        [PATH_1, StatusCodeNumber.MODIFIED],
        [PATH_2, StatusCodeNumber.IGNORED],
      ]);
    });

    it('retrieves cached hg status.', () => {
      // Force the state of the cache.
      const status = repo.getCachedPathStatus(PATH_1);
      expect(repo.isStatusModified(status)).toBe(true);
      expect(repo.isStatusNew(status)).toBe(false);
    });

    it('retrieves cached hg ignore status.', () => {
      const status = repo.getCachedPathStatus(PATH_2);
      // The status codes have no meaning; just test the expected translated
      // meanings.
      expect(repo.isStatusModified(status)).toBe(false);
      expect(repo.isStatusNew(status)).toBe(false);
    });

    it('returns a clean status by default.', () => {
      const status = repo.getCachedPathStatus('path-not-in-cache');
      // The status codes have no meaning; just test the expected translated
      // meanings.
      expect(repo.isStatusModified(status)).toBe(false);
      expect(repo.isStatusNew(status)).toBe(false);
    });
  });

  describe('the hgDiffCache', () => {
    beforeEach(() => {
      // Unfortunately, when the temp files in these tests are opened in the editor,
      // editor.getPath() returns the original file path with '/private/' appended
      // to it. Thus, the path returned from editor.getPath() (which is what is
      // used in HgRepository) would fail a real 'contains' method. So we override
      // this to the expected path.
      featureConfig.set('nuclide-hg-repository.enableDiffStats', true);
      const workingDirectoryClone = new Directory(tempDir);
      spyOn(workingDirectory, 'contains').andCallFake(filePath => {
        const prefix = '/private';
        if (filePath.startsWith(prefix)) {
          const prefixRemovedPath = filePath.slice(prefix.length);
          return workingDirectoryClone.contains(prefixRemovedPath);
        }
        return workingDirectoryClone.contains(filePath);
      });

      const projectDirectoryClone = new Directory(tempSubDir);
      spyOn(projectDirectory, 'contains').andCallFake(filePath => {
        const prefix = '/private';
        if (filePath.startsWith(prefix)) {
          const prefixRemovedPath = filePath.slice(prefix.length);
          return projectDirectoryClone.contains(prefixRemovedPath);
        }
        return projectDirectoryClone.contains(filePath);
      });

      spyOn(repo, '_updateDiffInfo').andReturn(Observable.of('fake'));
      spyOn(repo, '_observePaneItemVisibility').andReturn(Observable.of(true));
    });

    // eslint-disable-next-line jasmine/no-disabled-tests
    xit(
      'is updated when the active pane item changes to an editor, if the editor file is in the' +
        ' project.',
      () => {
        const file = temp.openSync({dir: projectDirectory.getPath()});
        waitsForPromise(async () => {
          const editor = await atom.workspace.open(file.path);
          expect(repo._updateDiffInfo.calls.length).toBe(1);
          expect(repo._updateDiffInfo).toHaveBeenCalledWith(editor.getPath());
        });
      },
    );

    it(
      'is not updated when the active pane item changes to an editor whose file is not in the' +
        ' repo.',
      () => {
        const file = temp.openSync();
        waitsForPromise(async () => {
          await atom.workspace.open(file.path);
          expect(repo._updateDiffInfo.calls.length).toBe(0);
        });
      },
    );

    it(
      'marks a file to be removed from the cache after its editor is closed, if the file is in the' +
        ' project.',
      () => {
        const file = temp.openSync({dir: projectDirectory.getPath()});
        repo._hgUncommittedStatusChanges.statusChanges = Observable.of(
          new Map().set(file.path, 1),
        );
        waitsForPromise(async () => {
          const editor = await atom.workspace.open(file.path);
          expect(repo._hgDiffCacheFilesToClear.size).toBe(0);
          editor.destroy();
          const expectedSet = new Set([editor.getPath()]);
          expect(repo._hgDiffCacheFilesToClear).toEqual(expectedSet);
        });
      },
    );
  });

  describe('::_updateDiffInfo', () => {
    const mockDiffInfo = {
      added: 2,
      deleted: 11,
      lineDiffs: [
        {
          oldStart: 150,
          oldLines: 11,
          newStart: 150,
          newLines: 2,
        },
      ],
    };

    beforeEach(() => {
      spyOn(repo, '_getCurrentHeadId').andReturn(Observable.of('test'));
      spyOn(
        repo._service,
        'fetchFileContentAtRevision',
      ).andCallFake(filePath => {
        return new Observable.of('test').publish();
      });
      spyOn(repo, '_getFileDiffs').andCallFake(pathsToFetch => {
        const diffs = [];
        for (const filePath of pathsToFetch) {
          diffs.push([filePath, mockDiffInfo]);
        }
        return Observable.of(diffs);
      });
      spyOn(workingDirectory, 'contains').andCallFake(() => {
        return true;
      });
    });

    it('updates the cache when the path to update is not already being updated.', () => {
      waitsForPromise(async () => {
        expect(repo._hgDiffCache.get(PATH_1)).toBeUndefined();
        await repo._updateDiffInfo([PATH_1]).toPromise();
        expect(repo._hgDiffCache.get(PATH_1)).toEqual(mockDiffInfo);
      });
    });

    it('removes paths that are marked for removal from the cache.', () => {
      // Set up some mock paths to be removed. One already exists in the cache,
      // the other is going to be attempted to be updated. Both should be removed.
      const testPathToRemove1 = PATH_1;
      const testPathToRemove2 = PATH_2;
      repo._hgDiffCache.set(testPathToRemove1, {
        added: 0,
        deleted: 0,
        lineDiffs: [],
      });
      repo._hgDiffCacheFilesToClear.add(testPathToRemove1);
      repo._hgDiffCacheFilesToClear.add(testPathToRemove2);

      waitsForPromise(async () => {
        await repo._updateDiffInfo([testPathToRemove2]).toPromise();
        expect(repo._hgDiffCache.get(testPathToRemove1)).not.toBeDefined();
        expect(repo._hgDiffCache.get(testPathToRemove2)).not.toBeDefined();
      });
    });
  });

  describe('::getCachedPathStatus/::getPathStatus', () => {
    it('handles a null or undefined input "path" but handles paths with those names.', () => {
      // Force the state of the cache.
      repo._hgStatusCache = new Map([
        [PATH_CALLED_NULL, StatusCodeNumber.MODIFIED],
        [PATH_CALLED_UNDEFINED, StatusCodeNumber.MODIFIED],
      ]);
      expect(repo.getCachedPathStatus(null)).toBe(StatusCodeNumber.CLEAN);
      expect(repo.getCachedPathStatus(undefined)).toBe(StatusCodeNumber.CLEAN);
      expect(repo.getCachedPathStatus(PATH_CALLED_NULL)).toBe(
        StatusCodeNumber.MODIFIED,
      );
      expect(repo.getCachedPathStatus(PATH_CALLED_UNDEFINED)).toBe(
        StatusCodeNumber.MODIFIED,
      );
    });
  });

  describe('::isStatusModified', () => {
    it('returns false for a null or undefined input.', () => {
      expect(repo.isStatusModified(null)).toBe(false);
      expect(repo.isStatusModified(undefined)).toBe(false);
    });
  });

  describe('::isStatusNew', () => {
    it('returns false for a null or undefined input.', () => {
      expect(repo.isStatusNew(null)).toBe(false);
      expect(repo.isStatusNew(undefined)).toBe(false);
    });
  });

  describe('::getDiffStats', () => {
    it(
      'returns clean stats if the path is null or undefined, but handles paths with those' +
        ' names.',
      () => {
        const mockDiffInfo = {
          added: 1,
          deleted: 1,
          lineDiffs: [
            {
              oldStart: 2,
              oldLines: 1,
              newStart: 2,
              newLines: 1,
            },
          ],
        };
        // Force the state of the cache.
        repo._hgDiffCache = new Map([
          [PATH_CALLED_NULL, mockDiffInfo],
          [PATH_CALLED_UNDEFINED, mockDiffInfo],
        ]);
        const cleanStats = {added: 0, deleted: 0};
        const expectedChangeStats = {added: 1, deleted: 1};
        expect(repo.getDiffStats(null)).toEqual(cleanStats);
        expect(repo.getDiffStats(undefined)).toEqual(cleanStats);
        expect(repo.getDiffStats(PATH_CALLED_NULL)).toEqual(
          expectedChangeStats,
        );
        expect(repo.getDiffStats(PATH_CALLED_UNDEFINED)).toEqual(
          expectedChangeStats,
        );
      },
    );
  });

  describe('::getLineDiffs', () => {
    it(
      'returns an empty array if the path is null or undefined, but handles paths with those' +
        ' names.',
      () => {
        const mockDiffInfo = {
          added: 1,
          deleted: 1,
          lineDiffs: [
            {
              oldStart: 2,
              oldLines: 1,
              newStart: 2,
              newLines: 1,
            },
          ],
        };
        // Force the state of the cache.
        repo._hgDiffCache = new Map([
          [PATH_CALLED_NULL, mockDiffInfo],
          [PATH_CALLED_UNDEFINED, mockDiffInfo],
        ]);
        // For now the second argument, 'text', is not used.
        expect(repo.getLineDiffs(null, null)).toEqual([]);
        expect(repo.getLineDiffs(undefined, null)).toEqual([]);
        expect(repo.getLineDiffs(PATH_CALLED_NULL, null)).toEqual(
          mockDiffInfo.lineDiffs,
        );
        expect(repo.getLineDiffs(PATH_CALLED_UNDEFINED, null)).toEqual(
          mockDiffInfo.lineDiffs,
        );
      },
    );
  });

  describe('::destroy', () => {
    it('should do cleanup without throwing an exception.', () => {
      const spy = jasmine.createSpy();
      repo.onDidDestroy(spy);
      repo.destroy();
      expect(spy).toHaveBeenCalled();
    });
  });
});
