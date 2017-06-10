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

import RecentFilesService from '../lib/RecentFilesService';

import invariant from 'assert';

const ON_DID_CHANGE_ACTIVE_PANE_ITEM_DEBOUNCE_MS = 101;
const FILE_PATH_1 = 'foo/bar/foo.js';
const FILE_PATH_2 = 'foo/bar/bar.js';
const FILE_PATH_3 = 'foo/bar/baz.js';

describe('RecentFilesService', () => {
  let recentFilesService: any;

  beforeEach(() => {
    recentFilesService = new RecentFilesService();
  });

  describe('getRecentFiles', () => {
    it('returns a reverse-chronological list of recently opened files', () => {
      waitsForPromise(async () => {
        let mostRecentFiles;
        let previousTimestamp = 0;
        expect(recentFilesService.getRecentFiles().length).toEqual(0);

        await atom.workspace.open(FILE_PATH_1);
        advanceClock(ON_DID_CHANGE_ACTIVE_PANE_ITEM_DEBOUNCE_MS);
        mostRecentFiles = recentFilesService.getRecentFiles();
        expect(mostRecentFiles.length).toEqual(1);
        expect(mostRecentFiles[0].path.endsWith(FILE_PATH_1)).toBe(true);
        expect(mostRecentFiles[0].timestamp).toBeGreaterThan(previousTimestamp);
        previousTimestamp = mostRecentFiles[0].timestamp;

        await atom.workspace.open(FILE_PATH_2);
        advanceClock(ON_DID_CHANGE_ACTIVE_PANE_ITEM_DEBOUNCE_MS);
        mostRecentFiles = recentFilesService.getRecentFiles();
        expect(mostRecentFiles.length).toEqual(2);
        expect(mostRecentFiles[0].path.endsWith(FILE_PATH_2)).toBe(true);
        expect(mostRecentFiles[0].timestamp).toBeGreaterThan(previousTimestamp);

        previousTimestamp = mostRecentFiles[0].timestamp;
        await atom.workspace.open(FILE_PATH_3);
        advanceClock(ON_DID_CHANGE_ACTIVE_PANE_ITEM_DEBOUNCE_MS);
        mostRecentFiles = recentFilesService.getRecentFiles();
        expect(mostRecentFiles.length).toEqual(3);
        expect(mostRecentFiles[0].path.endsWith(FILE_PATH_3)).toBe(true);
        expect(mostRecentFiles[0].timestamp).toBeGreaterThan(previousTimestamp);
      });
    });

    it('returns paths and timestamps of recently opened files', () => {
      waitsForPromise(async () => {
        await atom.workspace.open(FILE_PATH_1);
        advanceClock(ON_DID_CHANGE_ACTIVE_PANE_ITEM_DEBOUNCE_MS);
        const recentFiles = recentFilesService.getRecentFiles();
        const mostRecentFile = recentFiles[0];
        expect(Object.keys(mostRecentFile).length).toEqual(2);
        expect(typeof mostRecentFile.timestamp === 'number').toBe(true);
        expect(mostRecentFile.path.endsWith(FILE_PATH_1)).toBe(true);
      });
    });

    it('resets the order of previously tracked files when they are touched', () => {
      waitsForPromise(async () => {
        let mostRecentFiles;
        expect(recentFilesService.getRecentFiles().length).toEqual(0);

        await atom.workspace.open(FILE_PATH_1);
        advanceClock(ON_DID_CHANGE_ACTIVE_PANE_ITEM_DEBOUNCE_MS);
        mostRecentFiles = recentFilesService.getRecentFiles();
        expect(mostRecentFiles.length).toEqual(1);
        expect(mostRecentFiles[0].path.endsWith(FILE_PATH_1)).toBe(true);

        await atom.workspace.open(FILE_PATH_2);
        advanceClock(ON_DID_CHANGE_ACTIVE_PANE_ITEM_DEBOUNCE_MS);
        mostRecentFiles = recentFilesService.getRecentFiles();
        expect(mostRecentFiles.length).toEqual(2);
        expect(mostRecentFiles[0].path.endsWith(FILE_PATH_2)).toBe(true);

        await atom.workspace.open(FILE_PATH_1);
        advanceClock(ON_DID_CHANGE_ACTIVE_PANE_ITEM_DEBOUNCE_MS);
        mostRecentFiles = recentFilesService.getRecentFiles();
        expect(mostRecentFiles.length).toEqual(2);
        expect(mostRecentFiles[0].path.endsWith(FILE_PATH_1)).toBe(true);
        expect(mostRecentFiles[1].path.endsWith(FILE_PATH_2)).toBe(true);

        await atom.workspace.open(FILE_PATH_2);
        advanceClock(ON_DID_CHANGE_ACTIVE_PANE_ITEM_DEBOUNCE_MS);
        mostRecentFiles = recentFilesService.getRecentFiles();
        expect(mostRecentFiles.length).toEqual(2);
        expect(mostRecentFiles[0].path.endsWith(FILE_PATH_2)).toBe(true);
        expect(mostRecentFiles[1].path.endsWith(FILE_PATH_1)).toBe(true);
      });
    });
  });

  describe('initialization and de-serialization', () => {
    it('correctly restores itself from serialized state', () => {
      const serializedState = {
        filelist: [
          {path: FILE_PATH_1, timestamp: 100},
          {path: FILE_PATH_2, timestamp: 200},
          {path: FILE_PATH_3, timestamp: 300},
        ],
      };
      const restoredRecentFilesService = new RecentFilesService(
        serializedState,
      );
      const mostRecentFiles = restoredRecentFilesService.getRecentFiles();
      expect(mostRecentFiles).toEqual(serializedState.filelist);
    });

    it('starts out empty if no serialized state is passed to the constructor', () => {
      invariant(recentFilesService);
      expect(recentFilesService.getRecentFiles().length).toEqual(0);
    });
  });
});
