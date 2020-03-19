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

import {ConnectableObservable, Observable, Subject} from 'rxjs';
import type {DiffInfo, StatusCodeIdValue, BookmarkInfo} from '../lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

class MockHgRepositorySubscriptions {
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

  observeHgConflictStateDidChange(): ConnectableObservable<void> {
    return new Subject().publish();
  }

  observeActiveBookmarkDidChange(): ConnectableObservable<void> {
    return new Subject().publish();
  }

  observeBookmarksDidChange(): ConnectableObservable<void> {
    return new Subject().publish();
  }
}

// This class is meant to be stubbed out.
export default class MockHgService {
  createRepositorySubscriptions(): Promise<MockHgRepositorySubscriptions> {
    return Promise.resolve(new MockHgRepositorySubscriptions());
  }

  fetchStatuses(
    filePaths: Array<NuclideUri>,
    options: ?any,
  ): ConnectableObservable<Map<string, StatusCodeIdValue>> {
    return new Subject().publish();
  }

  deleteBookmark(name: string): Promise<void> {
    return Promise.resolve();
  }

  renameBookmark(name: string, nextName: string): Promise<void> {
    return Promise.resolve();
  }

  fetchDiffInfo(
    filePaths: Array<NuclideUri>,
  ): Promise<?Map<NuclideUri, DiffInfo>> {
    return Promise.resolve(null);
  }

  fetchActiveBookmark(): Promise<string> {
    return Promise.resolve('');
  }

  fetchBookmarks(): Promise<Array<BookmarkInfo>> {
    return Promise.resolve([]);
  }

  dispose(): Promise<void> {
    return Promise.resolve();
  }

  getHeadId(): Observable<string> {
    return new Observable();
  }

  getFullHashForRevision(): Promise<?string> {
    return Promise.resolve(null);
  }

  fetchFileContentAtRevision(
    filePath: NuclideUri,
    revision: string,
  ): ConnectableObservable<string> {
    return new Subject().publish();
  }
}
