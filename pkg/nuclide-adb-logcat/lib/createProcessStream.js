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

import {observeProcess} from 'nuclide-commons/process';
import {compact} from 'nuclide-commons/observable';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {Observable} from 'rxjs';

export function createProcessStream(): Observable<string> {
  const processEvents = observeProcess(
    ((featureConfig.get('nuclide-adb-logcat.pathToAdb'): any): string),
    ['logcat', '-v', 'long'],
    {/* TODO(T17353599) */ isExitError: () => false},
  )
    .catch(error => Observable.of({kind: 'error', error})) // TODO(T17463635)
    .share();
  const stdoutEvents = processEvents
    .filter(event => event.kind === 'stdout')
    // Not all versions of adb have a way to skip historical logs so we just ignore the first
    // second.
    .skipUntil(Observable.interval(1000).take(1));
  const otherEvents = processEvents.filter(event => event.kind !== 'stdout');

  return (
    compact(
      Observable.merge(stdoutEvents, otherEvents)
        // Forward the event, but add the last line of std err too. We can use this later if the
        // process exits to provide more information.
        .scan(
          (acc, event) => {
            switch (event.kind) {
              case 'error':
                throw event.error;
              case 'exit':
                throw new Error(acc.lastError || '');
              case 'stdout':
                // Keep track of the last error so that we can show it to users if the process dies
                // badly. If we get a non-error message, then the last error we saw wasn't the one
                // that killed the process, so throw it away. Why is this not on stderr? I don't know.
                return {
                  event,
                  lastError: parseError(event.data) || acc.lastError,
                };
              case 'stderr':
                return {
                  ...acc,
                  lastError: event.data || acc.lastError,
                  event,
                };
              default:
                // This should never happen.
                throw new Error(`Invalid event kind: ${event.kind}`);
            }
          },
          {event: null, lastError: null},
        )
        .map(acc => acc.event),
    )
      // Only get the text from stdout.
      .filter(event => event.kind === 'stdout')
      .map(event => event.data && event.data.replace(/\r*\n$/, ''))
  );
}

function parseError(line: string): ?string {
  const match = line.match(/^ERROR:\s*(.*)/);
  return match == null ? null : match[1].trim();
}
