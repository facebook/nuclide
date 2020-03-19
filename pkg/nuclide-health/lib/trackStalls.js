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

/* eslint-env browser */

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import observeStalls from 'nuclide-commons-ui/observeStalls';
import {HistogramTracker} from 'nuclide-analytics';

export default function trackStalls(): IDisposable {
  const histogram = new HistogramTracker(
    'event-loop-blocked',
    /* max */ 1000,
    /* buckets */ 10,
  );

  return new UniversalDisposable(
    histogram,
    observeStalls().subscribe(duration => {
      // Locally mark the occurrence of this stall so it appears in cpu profiles
      // as an entry in the json (with "cat": "blink.user_timing" for Chrome)
      // TODO: In the future this can include the duration as a detail following
      // the User Timing Level 3 Proposal: https://fburl.com/h6zaabap
      // For now, encode the duration into the mark name.
      performance.mark(`event-loop-blocked:${duration}`);

      // send to analytics
      histogram.track(duration);
    }),
  );
}
