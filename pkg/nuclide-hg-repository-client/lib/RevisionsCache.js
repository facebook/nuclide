/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {RevisionInfoFetched} from '../../nuclide-hg-rpc/lib/types';
import typeof * as HgService from '../../nuclide-hg-rpc/lib/HgService';

import {arrayEqual} from 'nuclide-commons/collection';
import {fastDebounce} from 'nuclide-commons/observable';
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
  revisionsFetched1: RevisionInfoFetched,
  revisionsFetched2: RevisionInfoFetched,
): boolean {
  const {
    revisions: revisions1,
    fromFilesystem: fromFilesystem1,
  } = revisionsFetched1;
  const {
    revisions: revisions2,
    fromFilesystem: fromFilesystem2,
  } = revisionsFetched2;
  const areBothFromFileSystem = fromFilesystem1 === fromFilesystem2;
  if (revisions1 === revisions2 && areBothFromFileSystem) {
    return true;
  }
  if (revisions1 == null || revisions2 == null) {
    return false;
  }
  return (
    areBothFromFileSystem &&
    arrayEqual(revisions1, revisions2, (revision1, revision2) => {
      return (
        revision1.id === revision2.id &&
        revision1.isHead === revision2.isHead &&
        arrayEqual(revision1.tags, revision2.tags) &&
        arrayEqual(revision1.bookmarks, revision2.bookmarks)
      );
    })
  );
}

export default class RevisionsCache {
  _workingDirectory: string;
  _revisions: BehaviorSubject<RevisionInfoFetched>;
  _lazyRevisionFetcher: Observable<RevisionInfoFetched>;
  _fetchRevisionsRequests: Subject<null>;
  _isFetchingRevisions: Subject<boolean>;
  _service: HgService;

  constructor(workingDirectory: string, service: HgService) {
    this._workingDirectory = workingDirectory;
    this._revisions = new BehaviorSubject({
      revisions: [],
      fromFilesystem: false,
    });
    this._fetchRevisionsRequests = new Subject();
    this._isFetchingRevisions = new Subject();
    this._service = service;

    this._lazyRevisionFetcher = this._fetchRevisionsRequests
      .startWith(null) // Initially, no refresh requests applied.
      .let(fastDebounce(FETCH_REVISIONS_DEBOUNCE_MS))
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
            // Failed to fetch smartlog, timeout and return an empty array
            return Observable.of({revisions: [], fromFilesystem: true});
          }),
      )
      .distinctUntilChanged(isEqualRevisions)
      .do(revisions => this._revisions.next(revisions))
      // $FlowFixMe
      .shareReplay(1);
  }

  _fetchSmartlogRevisions(): Observable<RevisionInfoFetched> {
    this._isFetchingRevisions.next(true);
    return this._service
      .fetchSmartlogRevisions(this._workingDirectory)
      .refCount()
      .map(revisions => ({revisions, fromFilesystem: true}))
      .timeout(FETCH_REVISIONS_TIMEOUT_MS)
      .catch(err => {
        if (err instanceof TimeoutError) {
          throw new Error('Timed out fetching smartlog revisions');
        }
        throw err;
      })
      .finally(() => {
        this._isFetchingRevisions.next(false);
      });
  }

  refreshRevisions(): void {
    this._fetchRevisionsRequests.next(null);
  }

  getCachedRevisions(): RevisionInfoFetched {
    return this._revisions.getValue();
  }

  observeRevisionChanges(): Observable<RevisionInfoFetched> {
    return this._lazyRevisionFetcher.startWith(this.getCachedRevisions());
  }

  observeIsFetchingRevisions(): Observable<boolean> {
    return this._isFetchingRevisions.asObservable();
  }
}
