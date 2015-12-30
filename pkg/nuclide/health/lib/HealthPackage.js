'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

type HealthStats = {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  heapPercentage: number;
  cpuPercentage: number;
  lastKeyLatency: number;
  activeHandles: number;
  activeRequests: number;
};

// This type needs to match the propTypes on the view components that display health data.
type StatsViewProps = {
  cpuPercentage?: number;
  memory?: number;
  heapPercentage?: number;
  lastKeyLatency?: number;
  activeHandles?: number;
  activeRequests?: number;
};

const BASE_ITEM_URI = 'nuclide-health://';

// Imports from non-Nuclide modules.
import {CompositeDisposable, Disposable} from 'atom';
import os from 'os';
import React from 'react-for-atom';
import Rx from 'rx';

// Imports from other Nuclide packages.
import {track} from '../../analytics';
import {atomEventDebounce} from '../../atom-helpers';
import featureConfig from '../../feature-config';

// Imports from within this Nuclide package.
import HealthPaneItem from './createHealthGadget';
import HealthPaneItemComponent from './ui/HealthPaneItemComponent';
import HealthStatusBarComponent from './ui/HealthStatusBarComponent';

// We may as well declare these outside of Activation because most of them really are nullable.
let currentConfig = {};
let statusBarItem: ?Element;
let paneItem: ?HTMLElement;
let viewTimeout: ?number = null;
let analyticsTimeout: ?number = null;
let analyticsBuffer: Array<HealthStats> = [];

// Variables for tracking where and when a key was pressed, and the time before it had an effect.
let activeEditorDisposables: ?CompositeDisposable = null;
let keyEditorId = 0;
let keyDownTime = 0;
let keyLatency = 0;
let lastKeyLatency = 0;

let paneItemState$: ?Rx.Subject = null;

class Activation {
  disposables: CompositeDisposable;

  constructor(state: ?Object) {
    this.disposables = new CompositeDisposable();
  }

  activate() {
    paneItemState$ = new Rx.Subject(null);
    this.disposables.add(
      featureConfig.onDidChange('nuclide-health', (event) => {
        currentConfig = event.newValue;
        // If user changes any config, update the health - and reset the polling cycles.
        updateViews();
        updateAnalytics();
      }),
      atom.workspace.onDidChangeActivePaneItem(disposeActiveEditorDisposables),
      atomEventDebounce.onWorkspaceDidStopChangingActivePaneItem(timeActiveEditorKeys),
      atom.workspace.addOpener(getHealthPaneItem),
      atom.commands.add(
        'atom-workspace',
        'nuclide-health:open-pane',
        () => atom.workspace.open(BASE_ITEM_URI, {searchAllPanes: true}),
      ),
      paneItemState$.forEach(renderPaneItem),
    );
    currentConfig = featureConfig.get('nuclide-health');
    timeActiveEditorKeys();
    updateViews();
    updateAnalytics();
  }

  dispose() {
    this.disposables.dispose();
    paneItemState$ = null;
    if (viewTimeout !== null) {
      clearTimeout(viewTimeout);
      viewTimeout = null;
    }
    if (analyticsTimeout !== null) {
      clearTimeout(analyticsTimeout);
      analyticsTimeout = null;
    }
    if (activeEditorDisposables) {
      activeEditorDisposables.dispose();
      activeEditorDisposables = null;
    }
  }
}

let activation: ?Activation = null;

export function activate(state: ?Object) {
  if (!activation) {
    activation = new Activation(state);
    activation.activate();
  }
}

export function deactivate() {
  if (activation) {
    activation.dispose();
    activation = null;
  }
}

export function consumeStatusBar(statusBar: any): void {
  statusBarItem = document.createElement('div');
  statusBarItem.className = 'inline-block nuclide-health';
  const tile = statusBar.addRightTile({
    item: statusBarItem,
    priority: -99, // Quite far right.
  });
  if (activation) {
    activation.disposables.add(
      atom.tooltips.add(
        statusBarItem,
        {title: 'Click the icon to display and configure Nuclide health stats.'}
      ),
      new Disposable(() => {
        tile.destroy();
        if (statusBarItem) {
          const parentNode = statusBarItem.parentNode;
          if (parentNode) {
            parentNode.removeChild(statusBarItem);
          }
          React.unmountComponentAtNode(statusBarItem);
          statusBarItem = null;
        }
      })
    );
  }
}

function getHealthPaneItem(uri: string): ?HTMLElement {
  if (!uri.startsWith(BASE_ITEM_URI)) {
    return;
  }
  paneItem = new HealthPaneItem().initialize(uri);
  return paneItem;
}

function disposeActiveEditorDisposables(): void {
  // Clear out any events & timing data from previous text editor.
  if (activeEditorDisposables != null) {
    activeEditorDisposables.dispose();
    activeEditorDisposables = null;
  }
}

function timeActiveEditorKeys(): void {
  disposeActiveEditorDisposables();
  activeEditorDisposables = new CompositeDisposable();

  // If option is enabled, start timing latency of keys on the new text editor.
  if (!currentConfig.showKeyLatency && !paneItem) {
    return;
  }

  // Ensure the editor is valid and there is a view to attatch the keypress timing to.
  const editor: ?TextEditor = atom.workspace.getActiveTextEditor();
  if (!editor) {
    return;
  }
  const view = atom.views.getView(editor);
  if (!view) {
    return;
  }

  // Start the clock when a key is pressed. Function is named so it can be disposed well.
  const startKeyClock = () => {
    if (editor) {
      keyEditorId = editor.id;
      keyDownTime = Date.now();
    }
  };

  // Stop the clock when the (same) editor has changed content.
  const stopKeyClock = () => {
    if (editor && editor.id && keyEditorId === editor.id && keyDownTime) {
      keyLatency = Date.now() - keyDownTime;
      // Reset so that subsequent non-key-initiated buffer updates don't produce silly big numbers.
      keyDownTime = 0;
    }
  };

  // Add the listener to keydown.
  view.addEventListener('keydown', startKeyClock);

  activeEditorDisposables.add(
    // Remove the listener in a home-made disposable for when this editor is no-longer active.
    new Disposable(() => view.removeEventListener('keydown', startKeyClock)),

    // stopKeyClock is fast so attatching it to onDidChange here is OK.
    // onDidStopChanging would be another option - any cost is deferred, but with far less fidelity.
    editor.onDidChange(stopKeyClock),
  );
}

function updateViews(): void {
  if (!paneItemState$) {
    return;
  }

  const stats = getHealthStats();
  analyticsBuffer.push(stats);
  updateStatusBar(stats);
  paneItemState$.onNext({stats, activeHandleObjects: getActiveHandles()});
  if (currentConfig.viewTimeout) {
    if (viewTimeout !== null) {
      clearTimeout(viewTimeout);
    }
    viewTimeout = setTimeout(updateViews, currentConfig.viewTimeout * 1000);
  }
}

function updateStatusBar(stats: HealthStats): void {
  if (!statusBarItem) {
    return;
  }
  const props: StatsViewProps = {};
  if (currentConfig.showCpu) {
    props.cpuPercentage = stats.cpuPercentage;
  }
  if (currentConfig.showHeap) {
    props.heapPercentage = stats.heapPercentage;
  }
  if (currentConfig.showMemory) {
    props.memory = stats.rss;
  }
  if (currentConfig.showKeyLatency) {
    props.lastKeyLatency = stats.lastKeyLatency;
  }
  if (currentConfig.showActiveHandles) {
    props.activeHandles = stats.activeHandles;
  }
  if (currentConfig.showActiveRequests) {
    props.activeRequests = stats.activeRequests;
  }

  React.render(
    <HealthStatusBarComponent
      {...props}
      onClickIcon={openHealthPane}
    />,
    statusBarItem
  );
}

function openHealthPane() {
  atom.commands.dispatch(atom.views.getView(atom.workspace), 'nuclide-health:open-pane');
}

function renderPaneItem(state: {stats: HealthStats, activeHandleObjects: Array<Object>}): void {
  if (paneItem == null || state == null) {
    return;
  }

  const {stats, activeHandleObjects} = state;

  React.render(
    <HealthPaneItemComponent
      cpuPercentage={stats.cpuPercentage}
      heapPercentage={stats.heapPercentage}
      memory={stats.rss}
      lastKeyLatency={stats.lastKeyLatency}
      activeHandles={activeHandleObjects.length}
      activeHandleObjects={activeHandleObjects}
      activeRequests={stats.activeRequests}
    />,
    paneItem
  );
}

function updateAnalytics(): void {
  if (analyticsBuffer.length > 0) {
    // Aggregates the buffered stats up by suffixing avg, min, max to their names.
    const aggregateStats = {};

    // All analyticsBuffer entries have the same keys; we use the first entry to know what they are.
    Object.keys(analyticsBuffer[0]).forEach(statsKey => {
      if (statsKey === 'lastKeyLatency') {
        return;
        // This field is only used to for a sticky value in the status bar, and is not to be sent.
      }

      const aggregates = aggregate(
        analyticsBuffer.map(stats => stats[statsKey]),
        (statsKey === 'keyLatency'), // skipZeros: Don't use empty key latency values in aggregates.
      );
      Object.keys(aggregates).forEach(aggregatesKey => {
        const value = aggregates[aggregatesKey];
        if (value !== null && value !== undefined) {
          aggregateStats[`${statsKey}_${aggregatesKey}`] = value.toFixed(2);
        }
      });
    });
    track('nuclide-health', aggregateStats);
    analyticsBuffer = [];
  }

  if (currentConfig.analyticsTimeout) {
    if (analyticsTimeout !== null) {
      clearTimeout(analyticsTimeout);
    }
    analyticsTimeout = setTimeout(updateAnalytics, currentConfig.analyticsTimeout * 60 * 1000);
  }
}

function aggregate(
  values: Array<number>,
  skipZeros: boolean = false,
): {avg: ?number, min: ?number, max: ?number} {
  // Some values (like memory usage) might be very high & numerous, so avoid summing them all up.
  if (skipZeros) {
    values = values.filter(value => value !== 0);
    if (values.length === 0) {
      return {avg: null, min: null, max: null};
    }
  }
  const avg = values.reduce((prevValue, currValue, index) => {
    return prevValue + (currValue - prevValue) / (index + 1);
  }, 0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return {avg, min, max};
}

function getHealthStats(): HealthStats {
  const stats = process.memoryUsage();                               // RSS, heap and usage.

  if (keyLatency) {
    lastKeyLatency = keyLatency;
  }

  const result = {
    ...stats,
    heapPercentage: (100 * stats.heapUsed / stats.heapTotal),   // Just for convenience.
    cpuPercentage: os.loadavg()[0],                             // 1 minute CPU average.
    lastKeyLatency,
    keyLatency,
    activeHandles: getActiveHandles().length,
    activeRequests: getActiveRequests().length,
  };

  keyLatency = 0; // We only want to ever record a key latency time once, and so we reset it.

  return result;
}

// These two functions are to defend against undocumented Node functions.
function getActiveHandles(): Array<Object> {
  if (process._getActiveHandles) {
    return process._getActiveHandles();
  }
  return [];
}

function getActiveRequests(): Array<Object> {
  if (process._getActiveRequests) {
    return process._getActiveRequests();
  }
  return [];
}

// TODO: This shouldn't actually be exported. We do so just because it requires access to module
//       state and we want to access it in the deserializer module.
export const _getHealthPaneItem = getHealthPaneItem;
