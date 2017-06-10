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

import type {Viewable} from '../../nuclide-workspace-views/lib/types';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {Observable} from 'rxjs';

/**
 * Atom's PaneContainer [doesn't call onDidAddItem when panes are moved][1]. Since we need to
 * include that, we have to roll our own.
 *
 * [1]: https://github.com/atom/atom/blob/v1.12.7/src/pane-container.coffee#L235
 */
export function observeAddedPaneItems(
  paneContainer: atom$PaneContainer,
): Observable<Viewable> {
  return observableFromSubscribeFunction(
    paneContainer.observePanes.bind(paneContainer),
  )
    .mergeMap(pane =>
      observableFromSubscribeFunction(pane.onDidAddItem.bind(pane)),
    )
    .map(event => {
      // Technically, Viewable isn't a subtype of PaneItem.
      const item = (event.item: atom$PaneItem);
      return ((item: any): Viewable);
    });
}
