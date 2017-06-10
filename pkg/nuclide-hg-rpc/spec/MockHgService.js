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

import {ConnectableObservable, Subject} from 'rxjs';
import type {DiffInfo, StatusCodeIdValue} from '../lib/HgService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

// This class is meant to be stubbed out.
export default class MockHgService {
  waitForWatchmanSubscriptions(): Promise<void> {
    return Promise.resolve();
  }

  fetchStatuses(
    filePaths: Array<NuclideUri>,
    options: ?any,
  ): ConnectableObservable<Map<string, StatusCodeIdValue>> {
    return new Subject().publish();
  }

  observeFilesDidChange(): ConnectableObservable<Array<NuclideUri>> {
    return new Subject().publish();
  }

  observeHgIgnoreFileDidChange(): ConnectableObservable<void> {
    return new Subject().publish();
  }

  observeHgRepoStateDidChange(): ConnectableObservable<void> {
    return new Subject().publish();
  }

  observeHgCommitsDidChange(): ConnectableObservable<void> {
    return new Subject().publish();
  }

  deleteBookmark(name: string): Promise<void> {
    return Promise.resolve();
  }

  renameBookmark(name: string, nextName: string): Promise<void> {
    return Promise.resolve();
  }

  observeHgConflictStateDidChange(): ConnectableObservable<void> {
    return new Subject().publish();
  }

  fetchDiffInfo(
    filePaths: Array<NuclideUri>,
  ): Promise<?Map<NuclideUri, DiffInfo>> {
    return Promise.resolve(null);
  }

  fetchActiveBookmark(): Promise<string> {
    return Promise.resolve('');
  }

  fetchBookmarks(): Promise<Array<Object>> {
    return Promise.resolve([]);
  }

  observeActiveBookmarkDidChange(): ConnectableObservable<void> {
    return new Subject().publish();
  }

  observeBookmarksDidChange(): ConnectableObservable<void> {
    return new Subject().publish();
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }
}
