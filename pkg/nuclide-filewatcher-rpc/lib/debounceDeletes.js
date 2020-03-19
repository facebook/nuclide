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

import type {WatchResult} from '..';

import {Observable} from 'rxjs';
import {takeWhileInclusive} from 'nuclide-commons/observable';

const DELETE_DELAY = 1000;

/**
 * Editors and command-line tools (e.g. Mercurial) often do atomic file writes by doing:
 *
 *  mv x x.tmp
 *  mv newfile x
 *
 * Watchman registers this as a file delete followed by a create.
 * This causes unnecessary churn for the Nuclide client.
 *
 * Instead, delay all delete events and cancel them if a change event interrupts them.
 */
export default function debounceDeletes(
  resultStream: Observable<WatchResult>,
): Observable<WatchResult> {
  const shared = resultStream.share();
  return shared
    .mergeMap(change => {
      switch (change.type) {
        case 'change':
          return Observable.of(change);
        case 'delete':
          return Observable.of(change)
            .delay(DELETE_DELAY)
            .takeUntil(shared);
      }
      throw new Error('unknown change type');
    })
    .let(takeWhileInclusive(change => change.type !== 'delete'));
}
