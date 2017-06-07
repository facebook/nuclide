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
import memoizeUntilChanged from 'nuclide-commons/memoizeUntilChanged';
import {Observable, Scheduler, Subject} from 'rxjs';
import shallowEqual from 'shallowequal';

// TODO(T17495608): Currently, docks don't have a way of observing their visibility so this will
//   have some false positives when an item is its pane's active item but its dock is hidden.
export default function observePaneItemVisibility(
  item: Object,
): Observable<boolean> {
  // If this is a version of Atom that doesn't have Docks, return an empty observable. Until they
  // land, the functionality is provided by the workspace views package, which calls
  // `didChangeVisibility()` on items automatically.
  // TODO cleanup post Atom 1.17
  if (atom.workspace.getPaneContainers == null) {
    return Observable.empty();
  }

  patchDocks();

  return Observable.combineLatest(
    // atom.workspace.reset() (in tests) resets all the panes.
    // Pass in atom.workspace.getElement() to act as a cache-breaker.
    // $FlowFixMe: Add atom.workspace.getElement() after 1.17.
    observeActiveItems(atom.workspace.getElement()),
    // $FlowFixMe: Add atom.workspace.getElement() after 1.17.
    observePaneContainerVisibilities(atom.workspace.getElement()),
  )
    .map(([activeItems, locationVisibilities]) => {
      // If it's not active, it's not visible.
      if (!activeItems.has(item)) {
        return false;
      }
      // If it's active, it's only visible if its container is.
      // $FlowFixMe: Add atom.workspace.paneContainerForItem() after 1.17.
      const paneContainer = atom.workspace.paneContainerForItem(item);
      const location = paneContainer && paneContainer.getLocation();
      return Boolean(locationVisibilities[location]);
    })
    .distinctUntilChanged();
}

const observeActiveItems = memoizeUntilChanged(_cacheKey => {
  // An observable that emits `{pane, item}` whenever the active item of a pane changes.
  const itemActivations = Observable.merge(
    // $FlowFixMe: Add `getPaneContainers()` to the type defs once Atom 1.17 lands.
    ...atom.workspace.getPaneContainers().map(paneContainer => {
      const observePanes = paneContainer.observePanes.bind(paneContainer);
      return observableFromSubscribeFunction(observePanes).flatMap(pane => {
        const paneDestroyed = observableFromSubscribeFunction(
          pane.onDidDestroy.bind(pane),
        );
        const activeItems = observableFromSubscribeFunction(
          pane.observeActiveItem.bind(pane),
        ).takeUntil(paneDestroyed);
        return Observable.concat(
          activeItems.map(item => ({pane, item})),
          Observable.of({pane, item: null}),
        );
      });
    }),
  );

  // Create a map of panes to their active items. We could look this up by examining the workspace
  // every time; this is an optimization.
  const panesToActiveItem = itemActivations.scan((acc, {pane, item}) => {
    if (item == null) {
      acc.delete(pane);
    } else {
      acc.set(pane, item);
    }
    return acc;
  }, new Map());

  return (
    panesToActiveItem
      // When dragging items between panes, they'll be quickly deactivated and activated again. To
      // avoid doing extra work, we debounce and use the rAF scheduler.
      .debounceTime(0, Scheduler.animationFrame)
      .map(map => new Set(map.values()))
      .share()
  );
});

// Create an observable that contains the current visibility state of each dock, but where the
// "false" values are delayed to account for the time it takes to animate the dock closed.
const observePaneContainerVisibilities = memoizeUntilChanged(_cacheKey => {
  const visibilitiesByDock = ['left', 'right', 'bottom'].map(loc =>
    dockStateChanges
      .filter(({location}) => location === loc)
      .switchMap(
        ({location, visible}) =>
          // Delay the "false" values so they don't occur while the dock is being animated closed.
          visible
            ? Observable.of({location, visible})
            : Observable.of({location, visible}).delay(300),
      )
      .distinctUntilKeyChanged('visible'),
  );

  const initialVisibilities = {
    // The center is always visible.
    center: true,
    // $FlowFixMe: This definition will be updated once we migrate to 1.17
    left: atom.workspace.getLeftDock().isVisible(),
    // $FlowFixMe: This definition will be updated once we migrate to 1.17
    right: atom.workspace.getRightDock().isVisible(),
    // $FlowFixMe: This definition will be updated once we migrate to 1.17
    bottom: atom.workspace.getBottomDock().isVisible(),
  };

  // Accumulate the dock visibilities.
  const visibilityStates = Observable.merge(...visibilitiesByDock)
    .scan(
      (acc, {location, visible}) => ({
        ...acc,
        [location]: visible,
      }),
      initialVisibilities,
    )
    .startWith(initialVisibilities)
    .distinctUntilChanged(shallowEqual)
    .publishReplay(1);
  visibilityStates.connect();

  return visibilityStates;
});

// HACK: Monkey-patch Docks in order to observe visibility toggling.
// TODO: Get a `Dock::observeVisibility()` upstreamed and use that API instead.
let docksPatched = false;
const dockStateChanges = new Subject();
function patchDocks() {
  if (docksPatched || typeof atom.workspace.getLeftDock !== 'function') {
    return;
  }
  docksPatched = true;
  const ctor = atom.workspace.getLeftDock().constructor;
  const proto = ctor.prototype;
  // $FlowIgnore
  const originalSetState = proto.setState;
  // $FlowIgnore
  proto.setState = function(newState, ...args) {
    originalSetState.call(this, newState, ...args);
    if (newState.hasOwnProperty('visible')) {
      dockStateChanges.next({
        location: this.getLocation(),
        visible: newState.visible,
      });
    }
  };
}
