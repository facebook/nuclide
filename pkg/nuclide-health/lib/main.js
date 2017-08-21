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

import type {HealthStats, PaneItemState} from './types';

// Imports from non-Nuclide modules.
import invariant from 'assert';
import {Disposable} from 'atom';
import React from 'react';
import {Observable} from 'rxjs';

// Imports from other Nuclide packages.
import {track} from '../../nuclide-analytics';
import createPackage from 'nuclide-commons-atom/createPackage';
import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import featureConfig from 'nuclide-commons-atom/feature-config';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {cacheWhileSubscribed} from 'nuclide-commons/observable';

// Imports from within this Nuclide package.
import HealthPaneItem, {WORKSPACE_VIEW_URI} from './HealthPaneItem';
import getChildProcessesTree from './getChildProcessesTree';
import getStats from './getStats';
import trackStalls from './trackStalls';

class Activation {
  _paneItemStates: Observable<PaneItemState>;
  _subscriptions: UniversalDisposable;

  _healthButton: ?HTMLElement;

  constructor(state: ?Object): void {
    (this: any)._updateToolbarJewel = this._updateToolbarJewel.bind(this);
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
    const toolbarJewels = configs
      .map(config => config.toolbarJewel || '')
      .distinctUntilChanged();

    // Update the stats immediately, and then periodically based on the config.
    const statsStream = Observable.of(null)
      .concat(viewTimeouts.switchMap(Observable.interval))
      .map(getStats)
      .share();

    const childProcessesTreeStream = Observable.of(null)
      .concat(viewTimeouts.switchMap(Observable.interval))
      .switchMap(getChildProcessesTree)
      .share();

    const packageStates = cacheWhileSubscribed(
      statsStream
        .withLatestFrom(toolbarJewels)
        .map(([stats, toolbarJewel]) => ({stats, toolbarJewel}))
        .share(),
    );

    const updateToolbarJewel = value => {
      featureConfig.set('nuclide-health.toolbarJewel', value);
    };
    this._paneItemStates = Observable.combineLatest(
      packageStates,
      Observable.of(null).concat(childProcessesTreeStream),
      (packageState, childProcessesTree) => ({
        ...packageState,
        childProcessesTree,
        updateToolbarJewel,
      }),
    );

    this._subscriptions = new UniversalDisposable(
      // Keep the toolbar jewel up-to-date.
      packageStates
        .map(formatToolbarJewelLabel)
        .subscribe(this._updateToolbarJewel),
      // Buffer the stats and send analytics periodically.
      statsStream
        .buffer(analyticsTimeouts.switchMap(Observable.interval))
        .subscribe(this._updateAnalytics),
      trackStalls(),
      this._registerCommandAndOpener(),
    );
  }

  dispose(): void {
    this._subscriptions.dispose();
  }

  consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
    const toolBar = getToolBar('nuclide-health');
    this._healthButton = toolBar.addButton({
      icon: 'dashboard',
      callback: 'nuclide-health:toggle',
      tooltip: 'Toggle Nuclide health stats',
      priority: -400,
    }).element;
    this._healthButton.classList.add('nuclide-health-jewel');
    const disposable = new Disposable(() => {
      this._healthButton = null;
      toolBar.removeItems();
    });
    this._subscriptions.add(disposable);
    return disposable;
  }

  _registerCommandAndOpener(): UniversalDisposable {
    invariant(this._paneItemStates);
    return new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          invariant(this._paneItemStates != null);
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

  _updateToolbarJewel(label: string): void {
    const healthButton = this._healthButton;
    if (healthButton != null) {
      healthButton.classList.toggle(
        'updated',
        healthButton.dataset.jewelValue !== label,
      );
      healthButton.dataset.jewelValue = label;
    }
  }

  _updateAnalytics(analyticsBuffer: Array<HealthStats>): void {
    if (analyticsBuffer.length === 0) {
      return;
    }

    // Aggregates the buffered stats up by suffixing avg, min, max to their names.
    const aggregateStats = {};

    // All analyticsBuffer entries have the same keys; we use the first entry to know what they
    // are.
    Object.keys(analyticsBuffer[0]).forEach(statsKey => {
      // These values are not to be aggregated or sent.
      if (statsKey === 'activeHandlesByType') {
        return;
      }

      const aggregates = aggregate(
        analyticsBuffer.map(
          stats => (typeof stats[statsKey] === 'number' ? stats[statsKey] : 0),
        ),
      );
      Object.keys(aggregates).forEach(aggregatesKey => {
        const value = aggregates[aggregatesKey];
        if (value !== null && value !== undefined) {
          aggregateStats[`${statsKey}_${aggregatesKey}`] = value.toFixed(2);
        }
      });
    });
    track('nuclide-health', aggregateStats);
  }
}

function aggregate(
  values: Array<number>,
): {avg: ?number, min: ?number, max: ?number} {
  const avg = values.reduce((prevValue, currValue, index) => {
    return prevValue + (currValue - prevValue) / (index + 1);
  }, 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {avg, min, max};
}

function formatToolbarJewelLabel(opts: {
  stats: HealthStats,
  toolbarJewel: string,
}): string {
  const {stats, toolbarJewel} = opts;
  switch (toolbarJewel) {
    case 'CPU':
      return `${stats.cpuPercentage.toFixed(0)}%`;
    case 'Heap':
      return `${stats.heapPercentage.toFixed(0)}%`;
    case 'Memory':
      return `${Math.floor(stats.rss / 1024 / 1024)}M`;
    case 'Handles':
      return `${stats.activeHandles}`;
    case 'Child processes':
      return `${stats.activeHandlesByType.childprocess.length}`;
    case 'Event loop':
      return `${stats.activeRequests}`;
    default:
      return '';
  }
}

createPackage(module.exports, Activation);
