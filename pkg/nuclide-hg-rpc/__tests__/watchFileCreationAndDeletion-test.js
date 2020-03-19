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
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {nextTick} from 'nuclide-commons/promise';
import {getFilesInstantaneousExistance} from '../lib/watchFileCreationAndDeletion';

describe('watchFileCreationAndDeletion', () => {
  describe('getFilesInstantaneousExistance', () => {
    it('correctly gets files existance', async () => {
      const repoPath = 'myRepoPath';
      const fileA = 'fileA.txt';
      const fileB = 'fileB.txt';
      const fileC = 'fileC.txt';
      const qualifiedFileA = nuclideUri.join(repoPath, fileA);
      const qualifiedFileB = nuclideUri.join(repoPath, fileB);
      const qualifiedFileC = nuclideUri.join(repoPath, fileC);
      let resolveFileA;
      const fileAPromise = new Promise(
        (resolve, reject) => (resolveFileA = resolve),
      );
      let resolveFileB;
      const fileBPromise = new Promise(
        (resolve, reject) => (resolveFileB = resolve),
      );
      let resolveFileC;
      const fileCPromise = new Promise(
        (resolve, reject) => (resolveFileC = resolve),
      );

      const existsSpy = jest
        .spyOn(fsPromise, 'exists')
        .mockImplementation(filename => {
          switch (filename) {
            case qualifiedFileA:
              return fileAPromise;
            case qualifiedFileB:
              return fileBPromise;
            case qualifiedFileC:
              return fileCPromise;
          }
          throw new Error(`unknown file ${filename} had existance checked`);
        });

      const files = [fileA, fileB, fileC];
      const existanceObservable = getFilesInstantaneousExistance(
        repoPath,
        files,
      );

      // $FlowFixMe
      resolveFileB(false);
      await nextTick();
      // $FlowFixMe
      resolveFileA(true);
      // $FlowFixMe
      resolveFileC(false);
      const existanceResult = await existanceObservable.toPromise();
      expect(existanceResult).toEqual(
        new Map([[fileA, true], [fileB, false], [fileC, false]]),
      );

      existsSpy.mockReset();
    });
  });
});
