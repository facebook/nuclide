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

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {Observable} from 'rxjs';

/**
 * Observe all of the panes in the container. This custom logic is required because of a weird Atom
 * behavior (bug?): `PaneContainer::getPanes()` doesn't include the added pane when called in the
 * `onDidAddPane` event callback. This function works around that issue by maintaining its own list
 * of panes.
 *
 * See https://github.com/atom/atom/issues/12654
 *     https://github.com/atom/atom/pull/12674
 */
export function observePanes(
  paneContainer: atom$PaneContainer,
): Observable<Set<atom$Pane>> {
  return Observable.defer(() => {
    let panes = new Set(paneContainer.getPanes());
    return Observable.merge(
      Observable.of(null),
      observableFromSubscribeFunction(
        paneContainer.onDidDestroyPane.bind(paneContainer),
      ).do(event => {
        panes = new Set(paneContainer.getPanes());
        panes.delete(event.pane);
      }),
      observableFromSubscribeFunction(
        paneContainer.onDidAddPane.bind(paneContainer),
      ).do(event => {
        panes = new Set(panes).add(event.pane);
      }),
    ).map(() => panes);
  });
}
