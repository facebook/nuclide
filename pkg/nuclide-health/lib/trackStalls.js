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

/* eslint-env browser */

import invariant from 'assert';
import nullthrows from 'nullthrows';
import {remote} from 'electron';
import {Observable} from 'rxjs';
import {PerformanceObservable} from 'nuclide-commons-ui/observable-dom';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {HistogramTracker} from '../../nuclide-analytics';

invariant(remote != null);

const CHROME_VERSION = Number(
  nullthrows(process.versions.chrome).split('.')[0],
);

// The startup period naturally causes many event loop blockages.
// Don't start checking blockages until some time has passed.
const BLOCKED_GRACE_PERIOD = 30000;
// Report all blockages over this threshold.
const BLOCKED_MIN = 100;
// Discard overly long blockages as spurious (e.g. computer was asleep)
const BLOCKED_MAX = 600000;
// Range padding on either side of long task interval.
// If an intentional block timestamp lies in this range,
// we consider it intentional.
const BLOCKED_RANGE_PADDING = 15;

export default function trackStalls(): IDisposable {
  const trackStart = performance.now();
  const browserWindow = remote.getCurrentWindow();
  const histogram = new HistogramTracker(
    'event-loop-blocked',
    /* max */ 1000,
    /* buckets */ 10,
  );

  let intentionalBlockTime = 0;
  const onIntentionalBlock = () => {
    intentionalBlockTime = performance.now();
  };

  const blockedEvents = new PerformanceObservable({entryTypes: ['longtask']})
    .flattenEntries()
    // only count if the window is focused when the task ran long
    .filter(() => document.hasFocus())
    // discard early longtasks as the app is booting
    .filter(() => performance.now() - trackStart > BLOCKED_GRACE_PERIOD)
    // early versions of chromium report times in *microseconds* instead of
    // milliseconds!
    .map(
      entry =>
        CHROME_VERSION <= 56
          ? {
              duration: entry.duration / 1000,
              startTime: entry.startTime / 1000,
            }
          : entry,
    )
    // discard durations that are unrealistically long, or those that aren't
    // meaningful enough
    .filter(
      entry => entry.duration > BLOCKED_MIN && entry.duration < BLOCKED_MAX,
    )
    // discard events that result from user interaction actually blocking the
    // thread when there is no other option (e.g. context menus)
    .filter(
      entry =>
        // did the intentionalblocktime occur between the start and end,
        // accounting for some extra padding?
        !(
          intentionalBlockTime > entry.startTime - BLOCKED_RANGE_PADDING &&
          intentionalBlockTime <
            entry.startTime + entry.duration + BLOCKED_RANGE_PADDING
        ),
    );

  return new UniversalDisposable(
    histogram,
    // Confirmation dialogs also block the event loop.
    // This typically happens when you're about to close an unsaved file.
    atom.workspace.onWillDestroyPaneItem(onIntentionalBlock),
    // Electron context menus block the event loop.
    Observable.fromEvent(browserWindow, 'context-menu')
      // There appears to be an race with browser window shutdown where
      // the 'context-menu' event fires after window destruction.
      // Try to prevent this by removing the event on close.
      // https://github.com/facebook/nuclide/issues/1246
      .takeUntil(Observable.fromEvent(browserWindow, 'close'))
      .subscribe(onIntentionalBlock),
    Observable.merge(
      // kick off subscription with a one-time query on start
      Observable.of(document.hasFocus()),
      Observable.fromEvent(browserWindow, 'focus').mapTo(true),
      Observable.fromEvent(browserWindow, 'blur').mapTo(false),
    )
      .distinctUntilChanged()
      .switchMap(isFocused => (isFocused ? blockedEvents : Observable.empty()))
      .subscribe(entry => {
        histogram.track(entry.duration);
      }),
  );
}
