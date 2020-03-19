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

import type {ProcessSummary} from './getChildProcesses';
import type {DOMCounters} from './getDOMCounters';
import type {HealthStats, PaneItemState} from './types';

// Imports from non-Nuclide modules.
import * as React from 'react';
import {Observable} from 'rxjs';
import {getLogger} from 'log4js';

// Imports from other Nuclide packages.
import {isTrackSupported, track} from 'nuclide-analytics';
import createPackage from 'nuclide-commons-atom/createPackage';
import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import featureConfig from 'nuclide-commons-atom/feature-config';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

// Imports from within this Nuclide package.
import HealthPaneItem, {WORKSPACE_VIEW_URI} from './HealthPaneItem';
import {
  queryPs,
  childProcessTree,
  childProcessSummary,
} from './getChildProcesses';
import getStats from './getStats';
import getDOMCounters from './getDOMCounters';
import trackKeyLatency from './trackKeyLatency';
import trackNewEditorLatency from './trackNewEditorLatency';
import trackStalls from './trackStalls';

class Activation {
  _paneItemStates: Observable<PaneItemState>;
  _subscriptions: UniversalDisposable;

  _healthButton: ?HTMLElement;

  constructor(state: ?Object): void {
    (this: any)._updateAnalytics = this._updateAnalytics.bind(this);

    // Observe all of the settings.
    const configs: Observable<any> = featureConfig.observeAsStream(
      'nuclide-health',
    );
    const viewTimeouts = configs
      .map(config => config.viewTimeout * 1000)
      .distinctUntilChanged();
    const analyticsTimeouts = configs
      .map(config => config.analyticsTimeout * 60 * 1000)
      .distinctUntilChanged();

    // Update the stats immediately, and then periodically based on the config.
    const statsStream = Observable.of(null)
      .concat(viewTimeouts.switchMap(Observable.interval))
      .map(getStats)
      .publishReplay(1)
      .refCount();

    const processTreeStream = Observable.of(null)
      .concat(viewTimeouts.switchMap(Observable.interval))
      .switchMap(() => queryPs('command'))
      .map(childProcessTree)
      .share();

    // Sample analytics streams at about the same time by sharing
    // the timer stream.
    const analyticsInterval = analyticsTimeouts
      .switchMap(Observable.interval)
      .share();

    // These aren't really aggregated because they're too expensive to fetch.
    // We'll just fetch these once per analytics upload cycle.
    // (Which means the first analytics upload won't have DOM counters).
    const domCounterStream = Observable.of(null)
      .concat(analyticsTimeouts.switchMap(Observable.interval))
      .switchMap(() => getDOMCounters())
      .publishReplay(1)
      .refCount();

    this._paneItemStates = Observable.combineLatest(
      statsStream,
      domCounterStream,
      Observable.of(null).concat(processTreeStream),
      (stats, domCounters, childProcessesTree) => ({
        stats,
        domCounters,
        childProcessesTree,
      }),
    );

    this._subscriptions = new UniversalDisposable(
      this._registerCommandAndOpener(),
    );

    if (isTrackSupported()) {
      this._subscriptions.add(
        Observable.zip(
          statsStream.buffer(analyticsInterval),
          analyticsInterval.switchMap(getDOMCounters),
          analyticsInterval.switchMap(() =>
            queryPs('comm').map(childProcessSummary),
          ),
        ).subscribe(
          ([buffer, domCounters, processes]) => {
            this._updateAnalytics(buffer, domCounters, processes);
          },
          error => {
            getLogger().error(
              'Failed to gather nuclide-health analytics.',
              error.stack,
            );
          },
        ),
        trackKeyLatency(),
        trackNewEditorLatency(),
        trackStalls(),
      );
    }
  }

  dispose(): void {
    this._subscriptions.dispose();
  }

  consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
    const toolBar = getToolBar('nuclide-health');
    this._healthButton = toolBar.addButton({
      icon: 'dashboard',
      callback: 'nuclide-health:toggle',
      tooltip: 'Toggle Nuclide Health Stats',
      priority: -400,
    }).element;
    this._healthButton.classList.add('nuclide-health-jewel');
    const disposable = new UniversalDisposable(() => {
      this._healthButton = null;
      toolBar.removeItems();
    });
    this._subscriptions.add(disposable);
    return disposable;
  }

  _registerCommandAndOpener(): UniversalDisposable {
    return new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return viewableFromReactElement(
            <HealthPaneItem stateStream={this._paneItemStates} />,
          );
        }
      }),
      () => destroyItemWhere(item => item instanceof HealthPaneItem),
      atom.commands.add('atom-workspace', 'nuclide-health:toggle', () => {
        atom.workspace.toggle(WORKSPACE_VIEW_URI);
      }),
    );
  }

  async _updateAnalytics(
    analyticsBuffer: Array<HealthStats>,
    domCounters: ?DOMCounters,
    subProcesses: ?Array<ProcessSummary>,
  ): Promise<void> {
    if (analyticsBuffer.length === 0) {
      return;
    }

    // Aggregates the buffered stats up by suffixing avg, min, max to their names.
    const state = {};

    // We don't have aggregates for these - these are just the most recent numbers.
    if (domCounters != null) {
      state.attachedDomNodes = domCounters.attachedNodes;
      state.domNodes = domCounters.nodes;
      state.domListeners = domCounters.jsEventListeners;
    }

    if (subProcesses != null) {
      state.subProcesses = subProcesses;
    }

    // All analyticsBuffer entries have the same keys; we use the first entry to know what they
    // are.
    Object.keys(analyticsBuffer[0]).forEach(statsKey => {
      // These values are not to be aggregated or sent.
      if (statsKey === 'activeHandlesByType') {
        return;
      }

      const aggregates = aggregateHealth(
        analyticsBuffer.map(
          stats => (typeof stats[statsKey] === 'number' ? stats[statsKey] : 0),
        ),
      );
      Object.keys(aggregates).forEach(aggregatesKey => {
        const value = aggregates[aggregatesKey];
        if (value != null) {
          state[`${statsKey}_${aggregatesKey}`] = value.toFixed(2);
        }
      });
    });
    track('nuclide-health', state);
  }
}

function aggregateHealth(
  values: Array<number>,
): {avg: ?number, min: ?number, max: ?number} {
  const sum = values.reduce((acc, value) => acc + value, 0);
  const avg = values.length > 0 ? sum / values.length : 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {avg, min, max};
}

createPackage(module.exports, Activation);
