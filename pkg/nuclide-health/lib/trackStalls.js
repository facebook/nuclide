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
/* global PerformanceObserver */

import invariant from 'assert';
import nullthrows from 'nullthrows';
import {remote} from 'electron';
import {getLogger} from 'log4js';
import {Observable} from 'rxjs';

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
  const disposables = new UniversalDisposable();

  let blockedDelay = setTimeout(() => {
    disposables.add(trackStallsImpl());
    blockedDelay = null;
  }, BLOCKED_GRACE_PERIOD);

  disposables.add(() => {
    if (blockedDelay != null) {
      clearTimeout(blockedDelay);
    }
  });

  return disposables;
}

function trackStallsImpl(): IDisposable {
  if (!supportsPerformanceObserversWithLongTasks()) {
    return new UniversalDisposable();
  }

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

  // $FlowFixMe No definition for PerformanceObserver
  const longTaskObserver = new PerformanceObserver(list => {
    if (!document.hasFocus()) {
      return;
    }

    const entries = list.getEntries();
    for (const entry of entries) {
      let duration;
      let startTime;
      if (CHROME_VERSION <= 56) {
        // Old versions of chrome implement longtask perf observers,
        // but their duration is in units of whole *microseconds* instead of
        // *milliseconds* with fractional units
        duration = entry.duration / 1000;
        startTime = entry.startTime / 1000;
      } else {
        duration = entry.duration;
        startTime = entry.startTime;
      }

      const withinReasonableWindow =
        duration > BLOCKED_MIN && duration < BLOCKED_MAX;

      // did the intentionalblocktime occur between the start and end,
      // accounting for some extra padding?
      const wasBlockedIntentionally =
        intentionalBlockTime > startTime - BLOCKED_RANGE_PADDING &&
        intentionalBlockTime < startTime + duration + BLOCKED_RANGE_PADDING;

      if (withinReasonableWindow && !wasBlockedIntentionally) {
        histogram.track(entry.duration);
        getLogger('nuclide-health').warn(
          `Event loop was blocked for ${duration} ms`,
        );
      }
    }
  });

  function startBlockedCheck() {
    longTaskObserver.observe({entryTypes: ['longtask']});
  }

  function stopBlockedCheck() {
    longTaskObserver.disconnect();
  }

  if (document.hasFocus()) {
    startBlockedCheck();
  }

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
    Observable.fromEvent(browserWindow, 'focus').subscribe(startBlockedCheck),
    Observable.fromEvent(browserWindow, 'blur').subscribe(stopBlockedCheck),
    () => stopBlockedCheck(),
  );
}

function supportsPerformanceObserversWithLongTasks() {
  let testObserver;
  let failed;

  try {
    // $FlowFixMe No definition for PerformanceObserver
    testObserver = new PerformanceObserver(() => {});
    testObserver.observe({entryTypes: ['longtask']});
  } catch (e) {
    failed = true;
  } finally {
    if (testObserver != null) {
      testObserver.disconnect();
    }
  }

  return !failed;
}
