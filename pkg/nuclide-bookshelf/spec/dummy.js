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

import type {BookShelfRepositoryState, BookShelfState} from '../lib/types';

import Immutable from 'immutable';

export const REPO_PATH_1 = '/fake/path_1';
export const SHOTHEAD_1_1 = 'foo';
export const SHOTHEAD_1_2 = 'bar';
export const ACTIVE_SHOTHEAD_1 = 'bar';

export function getDummyRepositoryState(): BookShelfRepositoryState {
  return {
    activeShortHead: ACTIVE_SHOTHEAD_1,
    isRestoring: false,
    shortHeadsToFileList: Immutable.Map([
      [SHOTHEAD_1_1, ['c.txt', 'd.txt']],
      [SHOTHEAD_1_2, ['e.txt']],
    ]),
  };
}

export function getDummyBookShelfState(): BookShelfState {
  return Object.freeze({
    repositoryPathToState: Immutable.Map([
      [REPO_PATH_1, getDummyRepositoryState()],
    ]),
  });
}
