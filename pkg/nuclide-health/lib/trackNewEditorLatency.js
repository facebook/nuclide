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

/* global performance */

import {TextEditor} from 'atom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {HistogramTracker} from 'nuclide-analytics';

const HISTOGRAM_MAX = 1000;
const HISTOGRAM_BUCKETS = 10;
const HISTOGRAM_INTERVAL_SEC = 10 * 60;

export default function trackNewEditorLatency(): IDisposable {
  const openEditorTracking = new HistogramTracker(
    'open-editor',
    HISTOGRAM_MAX,
    HISTOGRAM_BUCKETS,
    HISTOGRAM_INTERVAL_SEC,
  );
  const switchEditorTracking = new HistogramTracker(
    'switch-editor',
    HISTOGRAM_MAX,
    HISTOGRAM_BUCKETS,
    HISTOGRAM_INTERVAL_SEC,
  );
  // Attempt to ensure that this is the first listener that fires.
  const unshift = true;
  let pendingEditors = 0;
  const disposables = new UniversalDisposable(
    openEditorTracking,
    switchEditorTracking,
  );
  disposables.add(
    atom.workspace.getCenter().paneContainer.emitter.on(
      'did-add-pane-item',
      ({item}) => {
        if (item instanceof TextEditor) {
          const startTime = performance.now();
          pendingEditors++;
          setImmediate(() => {
            openEditorTracking.track(performance.now() - startTime);
            pendingEditors--;
          });
        }
      },
      unshift,
    ),
    atom.workspace.getCenter().observePanes(pane => {
      disposables.addUntilDestroyed(
        pane,
        // $FlowIgnore: emitter is private
        pane.emitter.on(
          'did-change-active-item',
          item => {
            // Adding a new pane item also triggers 'did-change-active-item'.
            if (pendingEditors === 0 && item instanceof TextEditor) {
              const startTime = performance.now();
              setImmediate(() => {
                switchEditorTracking.track(performance.now() - startTime);
              });
            }
          },
          unshift,
        ),
      );
    }),
  );
  return disposables;
}
