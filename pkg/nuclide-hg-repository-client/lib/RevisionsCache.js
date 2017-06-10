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

import type {HgService, RevisionInfo} from '../../nuclide-hg-rpc/lib/HgService';

import {arrayEqual} from 'nuclide-commons/collection';
import {BehaviorSubject, Observable, Subject, TimeoutError} from 'rxjs';
import {getLogger} from 'log4js';

const FETCH_REVISIONS_DEBOUNCE_MS = 100;
// The request timeout is 60 seconds anyways.
const FETCH_REVISIONS_TIMEOUT_MS = 50 * 1000;
const FETCH_REVISIONS_RETRY_COUNT = 2;

// The revisions haven't changed if the revisions' ids are the same.
// That's because commit ids are unique and incremental.
// Also, any write operation will update them.
// That way, we guarantee we only update the revisions state if the revisions are changed.
function isEqualRevisions(
  revisions1: Array<RevisionInfo>,
  revisions2: Array<RevisionInfo>,
): boolean {
  if (revisions1 === revisions2) {
    return true;
  }
  if (revisions1 == null || revisions2 == null) {
    return false;
  }
  return arrayEqual(revisions1, revisions2, (revision1, revision2) => {
    return (
      revision1.id === revision2.id &&
      revision1.isHead === revision2.isHead &&
      arrayEqual(revision1.tags, revision2.tags) &&
      arrayEqual(revision1.bookmarks, revision2.bookmarks)
    );
  });
}

export default class RevisionsCache {
  _hgService: HgService;
  _revisions: BehaviorSubject<Array<RevisionInfo>>;
  _lazyRevisionFetcher: Observable<Array<RevisionInfo>>;
  _fetchRevisionsRequests: Subject<null>;

  constructor(hgService: HgService) {
    this._hgService = hgService;
    this._revisions = new BehaviorSubject([]);
    this._fetchRevisionsRequests = new Subject();

    this._lazyRevisionFetcher = this._fetchRevisionsRequests
      .startWith(null) // Initially, no refresh requests applied.
      .debounceTime(FETCH_REVISIONS_DEBOUNCE_MS)
      .switchMap(() =>
        // Using `defer` will guarantee a fresh subscription / execution on retries,
        // even though `_fetchSmartlogRevisions` returns a `refCount`ed shared Observable.
        Observable.defer(() => this._fetchSmartlogRevisions())
          .retry(FETCH_REVISIONS_RETRY_COUNT)
          .catch(error => {
            getLogger('nuclide-hg-repository-client').error(
              'RevisionsCache Error:',
              error,
            );
            return Observable.empty();
          }),
      )
      .distinctUntilChanged(isEqualRevisions)
      .do(revisions => this._revisions.next(revisions))
      .share();
  }

  _fetchSmartlogRevisions(): Observable<Array<RevisionInfo>> {
    return this._hgService
      .fetchSmartlogRevisions()
      .refCount()
      .timeout(FETCH_REVISIONS_TIMEOUT_MS)
      .catch(err => {
        if (err instanceof TimeoutError) {
          throw new Error('Timed out fetching smartlog revisions');
        }
        throw err;
      });
  }

  refreshRevisions(): void {
    this._fetchRevisionsRequests.next(null);
  }

  getCachedRevisions(): Array<RevisionInfo> {
    return this._revisions.getValue();
  }

  observeRevisionChanges(): Observable<Array<RevisionInfo>> {
    return this._lazyRevisionFetcher.startWith(this.getCachedRevisions());
  }
}
