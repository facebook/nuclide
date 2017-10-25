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
import {track} from '../pkg/nuclide-analytics';

const DURATION_REPORTING_THRESHOLD_MS = 7; // report react-measured events > 7ms

const REACT_EMOJI = '\u269B';
const WARNING_EMOJI = '\u26D4';

// parse "mount" from '\u269B MarkedStringSnippet [mount]'
const LIFECYCLE_RE = new RegExp(
  `(${REACT_EMOJI}|${WARNING_EMOJI}) (\\S+) \\[(\\S+)\\]`,
);
const METHOD_RE = new RegExp(
  `(${REACT_EMOJI}|${WARNING_EMOJI}) (\\S+)\\.(\\S+)$`,
);

/**
 * Monitor important measurements while React renders out components.
 * The only reasonable way to do this is patching performance.measure as React
 * removes its measurements from performance timing immediately as it wants to
 * preserve the buffer memory, and events are logged to the timeline either way.
 *
 * This should only be loaded in Dev Mode. The production build of React
 * does not emit performance measurements, so it is not worth intercepting
 * events in that case.
 */
export default class ReactPerfMonitor {
  _disposed: boolean = false;

  constructor() {
    const oldMeasure = performance.measure.bind(performance);
    // $FlowFixMe Patching intentionally :)
    performance.measure = function measure(name, startMark, endMark) {
      oldMeasure(name, startMark, endMark);
      if (
        !this._disposed &&
        (name.startsWith(REACT_EMOJI) || name.startsWith(WARNING_EMOJI)) &&
        name[2] !== '(' // high-level react processes aren't interesting
      ) {
        const [entry] = performance.getEntriesByName(name, 'measure');

        let component;
        let lifecycle;
        let method;
        const lifecycleResult = name.match(LIFECYCLE_RE);
        const methodResult = name.match(METHOD_RE);
        if (lifecycleResult) {
          [, , component, lifecycle] = lifecycleResult;
        } else if (methodResult) {
          [, , component, method] = methodResult;
        }

        if (entry && entry.duration >= DURATION_REPORTING_THRESHOLD_MS) {
          track('react-performance', {
            duration: entry.duration.toString(),
            eventName: name.slice(2), // remove the emoji
            component,
            lifecycle,
            method,
          });
        }
      }
    };
  }

  dispose() {
    this._disposed = true;
  }
}
