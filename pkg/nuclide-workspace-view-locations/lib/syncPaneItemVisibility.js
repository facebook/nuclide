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

import {arrayCompact, setDifference} from 'nuclide-commons/collection';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';

export function syncPaneItemVisibility(
  panesStream: Observable<Set<atom$Pane>>,
  visibilityStream: Observable<boolean>,
): IDisposable {
  const activeItemsStream = panesStream
    .switchMap(panes_ => {
      const panes = Array.from(panes_);
      const activeItemChanges: Array<Observable<mixed>> = panes.map(pane =>
        observableFromSubscribeFunction(pane.observeActiveItem.bind(pane)),
      );
      return Observable.merge(...activeItemChanges).map(
        () => new Set(arrayCompact(panes.map(pane => pane.getActiveItem()))),
      );
    })
    .publishReplay(1);

  return new UniversalDisposable(
    // Whenever an item becomes active, `setItemVisibility(true)`
    activeItemsStream.subscribe(activeItems =>
      activeItems.forEach(item => {
        setItemVisibility(item, true);
      }),
    ),
    // When the pane container switches visibility, `setItemVisibility(paneContainerVisibility)`
    Observable.combineLatest(
      activeItemsStream,
      visibilityStream,
    ).subscribe(([activeItems, visible]) => {
      activeItems.forEach(item => setItemVisibility(item, visible));
    }),
    // When an item becomes inactive: if it's still in the container, `setItemVisibility(false)`
    activeItemsStream
      .pairwise()
      .withLatestFrom(panesStream)
      .subscribe(([[prev, next], panes_]) => {
        const deactivatedItems = setDifference(
          prev || new Set(),
          next || new Set(),
        );
        const panes = Array.from(panes_);
        deactivatedItems.forEach(item => {
          const stillInContainer = panes.some(pane =>
            pane.getItems().some(it => it === item),
          );
          if (stillInContainer) {
            setItemVisibility(item, false);
          }
        });
      }),
    activeItemsStream.connect(),
  );
}

function setItemVisibility(item, visible): void {
  if (typeof item.didChangeVisibility === 'function') {
    item.didChangeVisibility(visible);
  }
}
