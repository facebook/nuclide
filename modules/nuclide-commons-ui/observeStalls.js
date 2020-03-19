/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

/* eslint-env browser */

import invariant from 'assert';
import getDisplayName from 'nuclide-commons/getDisplayName';
import {remote} from 'electron';
import {Observable} from 'rxjs';
import {PerformanceObservable} from './observable-dom';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import once from 'nuclide-commons/once';

invariant(remote != null);

// The startup period naturally causes many event loop blockages.
// Don't start checking blockages until some time has passed.
const BLOCKED_GRACE_PERIOD = 30;
// Report all blockages over this threshold.
const BLOCKED_MIN = 100;
// Discard overly long blockages as spurious (e.g. computer was asleep)
const BLOCKED_MAX = 60 * 1000; // 1 minute in ms
// Range padding on either side of long task interval.
// If an intentional block timestamp lies in this range,
// we consider it intentional.
const BLOCKED_RANGE_PADDING = 15;

let intentionalBlockTime = 0;

// Share + cache the observable.
// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
const observeStalls = once(
  (): Observable<number> => {
    const browserWindow = remote.getCurrentWindow();

    const onIntentionalBlock = () => {
      intentionalBlockTime = performance.now();
    };

    const blockedEvents = new PerformanceObservable({entryTypes: ['longtask']})
      .flattenEntries()
      // only count if the window is focused when the task ran long
      .filter(() => document.hasFocus())
      // discard early longtasks as the app is booting
      .filter(() => process.uptime() > BLOCKED_GRACE_PERIOD)
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

    return Observable.using(
      () =>
        new UniversalDisposable(
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
        ),
      () => {
        return Observable.merge(
          // kick off subscription with a one-time query on start
          Observable.of(document.hasFocus()),
          Observable.fromEvent(browserWindow, 'focus').mapTo(true),
          Observable.fromEvent(browserWindow, 'blur').mapTo(false),
        )
          .distinctUntilChanged()
          .switchMap(
            isFocused => (isFocused ? blockedEvents : Observable.empty()),
          )
          .map(entry => entry.duration);
      },
    ).share();
  },
);

export default observeStalls;

/*
 * Often times users take an action and can resonably expect a long, blocking task
 * to run to completion before they can take action again:
 * https://developers.google.com/web/fundamentals/performance/rail#ux
 * This is analagous to a web page or app's initial loading, transitioning to
 * another significant view, etc.
 *
 * This is a decorator that wraps a function that pauses in response to user action,
 * opting it out of stall observation and forwarding any arguments passed and returning
 * the original function's return value.
 *
 * **Use this cautiously and deliberately, only in situations where it is
 * reasonable for a user to expect a pause!**
 *
 * If the action takes longer than 1s, we still record this as a stall, as it
 * fails the RAIL model's definition of responsive loading.
 */
export function intentionallyBlocksInResponseToUserAction<T, U>(
  fn: (...args: Array<T>) => U,
): (...args: Array<T>) => U {
  const intentionallyBlocks = function(...args: Array<T>) {
    const before = performance.now();
    const ret = fn.apply(this, args);
    if (performance.now() - before < 1000) {
      intentionalBlockTime = before;
    }

    return ret;
  };

  intentionallyBlocks.displayName = `intentionallyBlocks(${getDisplayName(
    fn,
  )})`;
  return intentionallyBlocks;
}
