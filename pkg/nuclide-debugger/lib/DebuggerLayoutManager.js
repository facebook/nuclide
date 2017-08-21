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
/* global localStorage */

import React from 'react';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import type {DebuggerModeType} from './types';
import {DebuggerPaneViewModel} from './DebuggerPaneViewModel';
import {DebuggerPaneContainerViewModel} from './DebuggerPaneContainerViewModel';
import DebuggerModel from './DebuggerModel';
import {DebuggerMode} from './DebuggerStore';
import invariant from 'assert';
import {__DEV__} from '../../nuclide-node-transpiler/lib/env';
import createPaneContainer from '../../commons-atom/create-pane-container';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';

// Debugger views
import {DebuggerControlsView} from './DebuggerControlsView';
import {ThreadsView} from './ThreadsView';
import {CallstackView} from './CallstackView';
import {BreakpointsView} from './BreakpointsView';
import {ScopesView} from './ScopesView';
import {WatchView} from './WatchView';

export type DebuggerPaneLocation = {
  dock: string,
  layoutIndex: number,
  userHidden: boolean,
};

// Configuration that defines a debugger pane. This controls what gets added
// to the workspace when starting debugging.
export type DebuggerPaneConfig = {
  // Each pane must provide a unique URI.
  uri: string,

  // Function that returns the title for the pane. Some panes (like Threads) need
  // to change their title depending on the debug target (ex "Threads" for C++ but
  // "Requests" for PHP).
  title: () => string,

  // Optional function that indicates if the pane is enabled for the current debug
  // session. If not enabled, the pane won't be added to the workspace.
  isEnabled?: () => boolean,

  // Boolean indicating if the debug session lifetime should be tied to this view.
  // If true, the debug session will be terminated if this view is destroyed.
  isLifetimeView: boolean,

  // Function that returns a view for Atom to use for the workspace pane.
  createView: () => React.Element<any>,

  // Optional filter function that lets panes specify that they should be shown
  // or hidden depending on the debugger mode (ex don't show threads when stopped).
  debuggerModeFilter?: (mode: DebuggerModeType) => boolean,

  // Structure to remember the pane's previous location if the user moved it around.
  previousLocation?: ?DebuggerPaneLocation,

  // Optional callback to be invoked when the pane is being resized (flex scale changed).
  onPaneResize?: (pane: atom$Pane, newFlexScale: number) => boolean,
};

export class DebuggerLayoutManager {
  _disposables: UniversalDisposable;
  _model: DebuggerModel;
  _debuggerPanes: Array<DebuggerPaneConfig>;
  _previousDebuggerMode: DebuggerModeType;
  _paneHiddenWarningShown: boolean;
  _leftPaneContainerModel: ?DebuggerPaneContainerViewModel;
  _rightPaneContainerModel: ?DebuggerPaneContainerViewModel;
  _debuggerVisible: boolean;

  constructor(model: DebuggerModel) {
    this._disposables = new UniversalDisposable();
    this._model = model;
    this._previousDebuggerMode = DebuggerMode.STOPPED;
    this._paneHiddenWarningShown = false;
    this._leftPaneContainerModel = null;
    this._rightPaneContainerModel = null;
    this._debuggerVisible = false;
    this._initializeDebuggerPanes();
    this._disposables.add(() => {
      if (this._leftPaneContainerModel != null) {
        this._leftPaneContainerModel.dispose();
      }
      if (this._rightPaneContainerModel != null) {
        this._rightPaneContainerModel.dispose();
      }
    });
  }

  dispose(): void {
    this._disposables.dispose();
  }

  registerContextMenus(): void {
    // Add context menus to let the user restore hidden panes.
    this._debuggerPanes.forEach(pane => {
      const command = `nuclide-debugger:show-window-${pane
        .title()
        .replace(/ /g, '-')}`;
      this._disposables.add(
        atom.commands.add('atom-workspace', {
          [String(command)]: () => this.showHiddenDebuggerPane(pane.uri),
        }),
      );

      this._disposables.add(
        atom.contextMenu.add({
          '.nuclide-debugger-container': [
            {
              label: 'Debugger Views',
              submenu: [
                {
                  label: `Show ${pane.title()} window`,
                  command,
                  shouldDisplay: event => {
                    const debuggerPane = this._debuggerPanes.find(
                      p => p.uri === pane.uri,
                    );
                    if (
                      debuggerPane != null &&
                      (debuggerPane.isEnabled == null ||
                        debuggerPane.isEnabled())
                    ) {
                      return (
                        debuggerPane.previousLocation != null &&
                        debuggerPane.previousLocation.userHidden
                      );
                    }
                    return false;
                  },
                },
              ],
            },
          ],
        }),
      );
    });
  }

  _overridePaneInitialHeight(
    dockPane: atom$Pane,
    newFlexScale: number,
    desiredHeight: number,
  ): void {
    invariant(dockPane.element != null);

    if (newFlexScale === 1) {
      // newFlexScale === 1 when the pane is added the first time.
      // $FlowFixMe
      dockPane.element.style['flex-grow'] = '0';
      // $FlowFixMe
      dockPane.element.style['flex-basis'] = 'auto';
      // $FlowFixMe
      dockPane.element.style['overflow-y'] = 'scroll';
      // $FlowFixMe
      dockPane.element.style['min-height'] = String(desiredHeight) + 'px';
    } else {
      // Otherwise, the user must have resized the pane. Remove the override styles
      // and let it behave normally, the user is in control of the layout now.
      // $FlowFixMe
      dockPane.element.style['min-height'] = '0px';
      // $FlowFixMe
      dockPane.element.style['flex-basis'] = '';
    }
  }

  _initializeDebuggerPanes(): void {
    const debuggerUriBase = 'atom://nuclide/debugger-';

    // This configures the debugger panes. By default, they'll appear below the stepping
    // controls from top to bottom in the order they're defined here. After that, the
    // user is free to move them around.
    this._debuggerPanes = [
      {
        uri: debuggerUriBase + 'controls',
        isLifetimeView: true,
        title: () => 'Debugger',
        isEnabled: () => true,
        createView: () => <DebuggerControlsView model={this._model} />,
        onPaneResize: (dockPane, newFlexScale) => {
          // If the debugger is stopped, let the controls pane keep its default
          // layout to make room for the buttons and additional content. Otherwise,
          // override the layout to shrink the pane and remove extra vertical whitespace.
          const debuggerMode = this._model.getStore().getDebuggerMode();
          if (debuggerMode !== DebuggerMode.STOPPED) {
            // If __DEV__, leave some extra space for the chrome devtools gear
            // TODO: Remove this when chrome is gone
            this._overridePaneInitialHeight(
              dockPane,
              newFlexScale,
              __DEV__ ? 155 : 130,
            );
          }

          // If newFlexScale !== 1, that means the user must have resized this pane.
          // Return true to unhook this callback and let the pane resize per Atom's
          // default behavior. The user is now responsible for the pane's height.
          return newFlexScale !== 1;
        },
      },
      {
        uri: debuggerUriBase + 'callstack',
        isLifetimeView: false,
        title: () => 'Call Stack',
        isEnabled: () => true,
        createView: () => <CallstackView model={this._model} />,
        debuggerModeFilter: (mode: DebuggerModeType) =>
          mode !== DebuggerMode.STOPPED,
      },
      {
        uri: debuggerUriBase + 'breakpoints',
        isLifetimeView: false,
        title: () => 'Breakpoints',
        isEnabled: () => true,
        createView: () => <BreakpointsView model={this._model} />,
      },
      {
        uri: debuggerUriBase + 'scopes',
        isLifetimeView: false,
        title: () => 'Scopes',
        isEnabled: () => true,
        createView: () => <ScopesView model={this._model} />,
        debuggerModeFilter: (mode: DebuggerModeType) =>
          mode !== DebuggerMode.STOPPED,
      },
      {
        uri: debuggerUriBase + 'watch-expressions',
        isLifetimeView: false,
        title: () => 'Watch Expressions',
        isEnabled: () => true,
        createView: () =>
          <WatchView
            model={this._model}
            watchExpressionListStore={this._model.getWatchExpressionListStore()}
          />,
      },
      {
        uri: debuggerUriBase + 'threads',
        isLifetimeView: false,
        title: () => {
          return String(
            this._model.getStore().getSettings().get('threadsComponentTitle'),
          );
        },
        isEnabled: () => {
          return Boolean(
            this._model.getStore().getSettings().get('SupportThreadsWindow'),
          );
        },
        createView: () => <ThreadsView model={this._model} />,
        debuggerModeFilter: (mode: DebuggerModeType) =>
          mode !== DebuggerMode.STOPPED,
      },
    ];

    this._restoreDebuggerPaneLocations();
  }

  showHiddenDebuggerPane(uri: string): void {
    const pane = this._debuggerPanes.find(p => p.uri === uri);
    if (pane != null && pane.previousLocation != null) {
      pane.previousLocation.userHidden = false;
    }

    this.showDebuggerViews();
  }

  getModelForDebuggerUri(uri: string): any {
    const config = this._debuggerPanes.find(pane => pane.uri === uri);
    if (config != null) {
      return new DebuggerPaneViewModel(
        config,
        this._model,
        config.isLifetimeView,
        pane => this._paneDestroyed(pane),
      );
    }

    return null;
  }

  _getWorkspaceDocks(): Array<{
    name: string,
    dock: atom$AbstractPaneContainer,
    orientation: string,
  }> {
    const docks = new Array(4);

    invariant(atom.workspace.getLeftDock != null);
    docks[0] = {
      name: 'left',
      dock: atom.workspace.getLeftDock(),
      orientation: 'vertical',
    };

    invariant(atom.workspace.getBottomDock != null);
    docks[1] = {
      name: 'bottom',
      dock: atom.workspace.getBottomDock(),
      orientation: 'horizontal',
    };

    invariant(atom.workspace.getCenter != null);
    docks[2] = {
      name: 'center',
      dock: atom.workspace.getCenter(),
      orientation: 'horizontal',
    };

    invariant(atom.workspace.getRightDock != null);
    docks[3] = {
      name: 'right',
      dock: atom.workspace.getRightDock(),
      orientation: 'vertical',
    };

    return docks;
  }

  _isDockEmpty(dock: atom$AbstractPaneContainer): boolean {
    const panes = dock.getPanes();

    // A dock is empty for our purposes if it has nothing visible in it. If a dock
    // with no items is left open, Atom implicitly adds a single pane with no items
    // in it, so check for no panes, or a single pane with no items.
    return (
      panes.length === 0 ||
      (panes.length === 1 && panes[0].getItems().length === 0)
    );
  }

  _appendItemToDock(
    paneConfig: ?DebuggerPaneConfig,
    dock: atom$AbstractPaneContainer,
    item: Object,
    debuggerItemsPerDock: Map<atom$AbstractPaneContainer, number>,
  ): void {
    const panes = dock.getPanes();
    invariant(panes.length >= 1);

    const dockPane = panes[panes.length - 1];
    if (this._isDockEmpty(dock)) {
      dockPane.addItem(item);
    } else {
      let dockConfig = this._getWorkspaceDocks().find(d => d.dock === dock);
      if (dockConfig == null) {
        // This item is being added to a nested PaneContainer rather than
        // directly to a dock. This is only done for vertical layouts.
        dockConfig = {orientation: 'vertical'};
      }

      if (dockConfig.orientation === 'horizontal') {
        // Add the item as a new tab in the existing pane to the right of the current active pane for the dock.
        dockPane.addItem(item);
        try {
          dockPane.activateItem(item);
        } catch (e) {
          // During testing, I saw some cases where Atom threw trying to activate an item
          // that was still in progress of being added. This was tested on a Beta release
          // and may indicate a temporary bug. However, there is no reason to throw here
          // and stop laying out the debugger if an item could not be set as active.
        }
      } else {
        // When adding to a vertical dock that is not empty, but contains no debugger
        // items, add the debugger pane container as a new tab item. Otherwise, append
        // downward.
        if (debuggerItemsPerDock.get(dock) == null) {
          dockPane.addItem(item);
          dockPane.activateItem(item);
        } else {
          dockPane.splitDown({
            items: [item],
          });
        }
      }
    }

    // Keep track of which dock(s) we've appended debugger panes into. This
    // allows us to quickly check if the dock needs to be split to separate
    // debugger panes and pre-existing panes that have nothing to do with
    // the debugger.
    if (debuggerItemsPerDock.get(dock) == null) {
      debuggerItemsPerDock.set(dock, 1);
    } else {
      const itemCount = debuggerItemsPerDock.get(dock);
      debuggerItemsPerDock.set(dock, itemCount + 1);
    }

    if (dock.isVisible != null && dock.show != null && !dock.isVisible()) {
      dock.show();
    }

    // If the debugger pane config has a custom layout callback, hook it up now.
    if (paneConfig != null && paneConfig.onPaneResize != null) {
      const disposables = new UniversalDisposable();
      disposables.add(dockPane.onWillDestroy(() => disposables.dispose()));
      disposables.add(
        dockPane.onDidChangeFlexScale(newFlexScale => {
          invariant(paneConfig.onPaneResize != null);
          if (paneConfig.onPaneResize(dockPane, newFlexScale)) {
            // The callback has requested to be unregistered.
            disposables.dispose();
          }
        }),
      );
    }
  }

  resetLayout(): void {
    // Remove all debugger panes from the UI.
    this.hideDebuggerViews(false);

    // Forget all their previous locations.
    for (const debuggerPane of this._debuggerPanes) {
      debuggerPane.previousLocation = null;
      const key = this._getPaneStorageKey(debuggerPane.uri);
      localStorage.setItem(key, '');
    }

    // Forget all previous dock sizes;
    for (const dockInfo of this._getWorkspaceDocks()) {
      const {name} = dockInfo;
      const key = this._getPaneStorageKey('dock-size' + name);
      localStorage.removeItem(key);
    }

    // Pop the debugger open with the default layout.
    this._debuggerPanes = [];
    this._paneHiddenWarningShown = false;
    this._initializeDebuggerPanes();
    this.showDebuggerViews();
  }

  _getPaneStorageKey(uri: string): string {
    return 'nuclide-debugger-pane-location-' + uri;
  }

  _deserializeSavedLocation(savedItem: string): ?DebuggerPaneLocation {
    try {
      const obj = JSON.parse(savedItem);
      if (
        obj != null &&
        obj.dock != null &&
        obj.layoutIndex != null &&
        obj.userHidden != null
      ) {
        return obj;
      }
    } catch (e) {}

    return null;
  }

  _restoreDebuggerPaneLocations(): void {
    // See if there are saved previous locations for the debugger panes.
    for (const debuggerPane of this._debuggerPanes) {
      const savedItem = localStorage.getItem(
        this._getPaneStorageKey(debuggerPane.uri),
      );
      if (savedItem != null) {
        debuggerPane.previousLocation = this._deserializeSavedLocation(
          savedItem,
        );
      }
    }
  }

  _saveDebuggerPaneLocations(): void {
    for (const dockInfo of this._getWorkspaceDocks()) {
      const {name, dock} = dockInfo;
      const panes = dock.getPanes();
      let layoutIndex = 0;
      let dockContainsDebuggerItem = false;
      for (const pane of panes) {
        for (const item of pane.getItems()) {
          const paneItems = [];
          if (item instanceof DebuggerPaneContainerViewModel) {
            paneItems.push(...item.getAllItems());
          } else {
            paneItems.push(item);
          }

          for (const itemToSave of paneItems) {
            if (itemToSave instanceof DebuggerPaneViewModel) {
              const location = {
                dock: name,
                layoutIndex,
                userHidden: false,
              };

              dockContainsDebuggerItem = true;
              itemToSave.getConfig().previousLocation = location;
              layoutIndex++;
            }
          }
        }
      }

      const key = this._getPaneStorageKey('dock-size' + name);
      if (dockContainsDebuggerItem) {
        // Save the size of a dock only if it contains a debugger item.
        const sizeInfo = JSON.stringify(dock.state.size);
        localStorage.setItem(key, sizeInfo);
      } else {
        localStorage.removeItem(key);
      }
    }

    // Serialize to storage.
    for (const debuggerPane of this._debuggerPanes) {
      const loc = JSON.stringify(debuggerPane.previousLocation);
      const key = this._getPaneStorageKey(debuggerPane.uri);
      localStorage.setItem(key, loc);
    }
  }

  _shouldDestroyPaneItem(mode: DebuggerModeType, item: atom$PaneItem): boolean {
    if (item instanceof DebuggerPaneViewModel) {
      const config = item.getConfig();
      if (
        config.debuggerModeFilter != null &&
        !config.debuggerModeFilter(mode)
      ) {
        item.setRemovedFromLayout(true);
        return true;
      }
    }
    return false;
  }

  debuggerModeChanged(): void {
    const mode = this._model.getStore().getDebuggerMode();

    // Most panes disappear when the debugger is stopped, only keep
    // the ones that should still be shown.
    if (
      mode === DebuggerMode.STOPPING &&
      this._previousDebuggerMode !== DebuggerMode.STOPPED
    ) {
      this._saveDebuggerPaneLocations();
    } else if (mode === DebuggerMode.STOPPED) {
      destroyItemWhere(item => {
        if (item instanceof DebuggerPaneContainerViewModel) {
          // Forward the destruction logic to the contianer.
          item.destroyWhere(innerItem =>
            this._shouldDestroyPaneItem(mode, innerItem),
          );

          this._destroyContainerIfEmpty(item);
          return false;
        }

        return this._shouldDestroyPaneItem(mode, item);
      });
    }

    this._previousDebuggerMode = mode;
  }

  _countPanesForTargetDock(dockName: string, defaultDockName: string): number {
    const mode = this._model.getStore().getDebuggerMode();
    return this._debuggerPanes
      .filter(
        // Filter out any panes that the user has hidden or that aren't visible
        // in the current debug mode.
        debuggerPane =>
          (debuggerPane.previousLocation == null ||
            !debuggerPane.previousLocation.userHidden) &&
          (debuggerPane.debuggerModeFilter == null ||
            debuggerPane.debuggerModeFilter(mode)),
      )
      .map(debuggerPane => {
        // Map each debugger pane to the name of the dock it will belong to.
        if (debuggerPane.previousLocation != null) {
          const previousDock = this._getWorkspaceDocks().find(
            d =>
              debuggerPane.previousLocation != null &&
              d.name === debuggerPane.previousLocation.dock,
          );
          if (previousDock != null) {
            return previousDock.name;
          }
        }
        return defaultDockName;
      })
      .filter(targetDockName => targetDockName === dockName).length;
  }

  _getSavedDebuggerPaneSize(dock: {
    name: string,
    dock: atom$AbstractPaneContainer,
    orientation: string,
  }): ?number {
    const key = this._getPaneStorageKey('dock-size' + dock.name);
    const savedItem = localStorage.getItem(key);
    if (savedItem != null) {
      const sizeInfo = JSON.parse(savedItem);
      if (!Number.isNaN(sizeInfo)) {
        return sizeInfo;
      }
    }

    return null;
  }

  showDebuggerViews(): void {
    // Hide any debugger panes other than the controls so we have a known
    // starting point for preparing the layout.
    this.hideDebuggerViews(true);

    const addedItemsByDock = new Map();
    const defaultDock = this._getWorkspaceDocks().find(d => d.name === 'right');
    invariant(defaultDock != null);

    const leftDock = this._getWorkspaceDocks().find(d => d.name === 'left');
    invariant(leftDock != null);

    let leftPaneContainer = null;
    if (this._countPanesForTargetDock(leftDock.name, defaultDock.name) > 0) {
      leftPaneContainer = createPaneContainer();
      const size = this._getSavedDebuggerPaneSize(leftDock);
      this._leftPaneContainerModel = this._addPaneContainerToWorkspace(
        leftPaneContainer,
        leftDock.dock,
        addedItemsByDock,
        size,
      );
    }

    const rightDock = this._getWorkspaceDocks().find(d => d.name === 'right');
    invariant(rightDock != null);

    let rightPaneContainer = null;
    if (this._countPanesForTargetDock(rightDock.name, defaultDock.name) > 0) {
      rightPaneContainer = createPaneContainer();
      const size = this._getSavedDebuggerPaneSize(rightDock);
      this._rightPaneContainerModel = this._addPaneContainerToWorkspace(
        rightPaneContainer,
        rightDock.dock,
        addedItemsByDock,
        size,
      );
    }

    // Lay out the remaining debugger panes according to their configurations.
    // Sort the debugger panes by the index at which they appeared the last
    // time they were positioned, so we maintain the relative ordering of
    // debugger panes within the same dock.
    const mode = this._model.getStore().getDebuggerMode();
    this._debuggerPanes
      .slice()
      .sort((a, b) => {
        const aPos =
          a.previousLocation == null ? 0 : a.previousLocation.layoutIndex;
        const bPos =
          b.previousLocation == null ? 0 : b.previousLocation.layoutIndex;
        return aPos - bPos;
      })
      .filter(
        debuggerPane =>
          debuggerPane.previousLocation == null ||
          !debuggerPane.previousLocation.userHidden,
      )
      .forEach(debuggerPane => {
        let targetDock = defaultDock;

        // If this pane had a previous location, restore to the previous dock.
        const loc = debuggerPane.previousLocation;
        if (loc != null) {
          const previousDock = this._getWorkspaceDocks().find(
            d => d.name === loc.dock,
          );
          if (previousDock != null) {
            targetDock = previousDock;
          }
        }

        // Render to a nested pane container for the two vertical docks
        // rather than adding the item directly to the dock itself.
        let targetContainer = targetDock.dock;
        if (targetDock.name === 'left') {
          targetContainer = leftPaneContainer;
        } else if (targetDock.name === 'right') {
          targetContainer = rightPaneContainer;
        }

        if (
          debuggerPane.debuggerModeFilter == null ||
          debuggerPane.debuggerModeFilter(mode)
        ) {
          invariant(targetContainer != null);
          const size = this._getSavedDebuggerPaneSize(targetDock);
          this._appendItemToDock(
            debuggerPane,
            targetContainer,
            new DebuggerPaneViewModel(
              debuggerPane,
              this._model,
              debuggerPane.isLifetimeView,
              pane => this._paneDestroyed(pane),
              size,
            ),
            addedItemsByDock,
          );
        }
      });

    this._debuggerVisible = true;
  }

  _addPaneContainerToWorkspace(
    container: atom$PaneContainer,
    dock: atom$AbstractPaneContainer,
    addedItemsByDock: Map<atom$AbstractPaneContainer, number>,
    dockSize: ?number,
  ): DebuggerPaneContainerViewModel {
    const containerModel = new DebuggerPaneContainerViewModel(
      this._model,
      container,
      dockSize,
    );
    this._appendItemToDock(null, dock, containerModel, addedItemsByDock);

    return containerModel;
  }

  _paneDestroyed(pane: DebuggerPaneConfig): void {
    if (pane.isLifetimeView) {
      // Lifetime views are not hidden and remembered like the unimportant views.
      // This view being destroyed means the debugger is exiting completely, and
      // this view is never remembered as "hidden by the user" because it's reqiured
      // for running the debugger.
      const mode = this._model.getStore().getDebuggerMode();
      if (mode === DebuggerMode.RUNNING || mode === DebuggerMode.PAUSED) {
        this._saveDebuggerPaneLocations();
      }

      this.hideDebuggerViews(false);
      this._model.getActions().stopDebugging();
      return;
    }

    // Views can be selectively hidden by the user while the debugger is
    // running and that preference should be remembered.
    const config = this._debuggerPanes.find(p => p.uri === pane.uri);
    invariant(config != null);

    if (config.previousLocation == null) {
      config.previousLocation = {
        dock: '',
        layoutIndex: 0,
        userHidden: false,
      };
    }

    if (config.isEnabled == null || config.isEnabled()) {
      const mode = this._model.getStore().getDebuggerMode();
      if (
        config.debuggerModeFilter == null ||
        config.debuggerModeFilter(mode)
      ) {
        invariant(config.previousLocation != null);
        config.previousLocation.userHidden = true;

        // Show a notification telling the user how to get the pane back
        // only once per session.
        if (!this._paneHiddenWarningShown) {
          this._paneHiddenWarningShown = true;

          atom.notifications.addInfo(
            `${config.title()} has been hidden. Right click any Debugger pane to bring it back.`,
          );
        }
      }
    }

    // If hiding this view left an empty debugger pane container, destroy the container.
    this._destroyContainerIfEmpty(this._leftPaneContainerModel);
    this._destroyContainerIfEmpty(this._rightPaneContainerModel);
  }

  _destroyContainerIfEmpty(container: ?DebuggerPaneContainerViewModel): void {
    if (container != null && container.getAllItems().length === 0) {
      const parent = container.getParentPane();
      if (parent != null) {
        parent.removeItem(container);
        container.destroy();
      }
    }
  }

  hideDebuggerViews(performingLayout: boolean): void {
    // Docks do not toggle closed automatically when we remove all their items.
    // They can contain things other than the debugger items though, and could
    // have been left open and empty by the user. Toggle closed any docks that
    // end up empty only as a result of closing the debugger.
    const docks = this._getWorkspaceDocks();
    const previouslyEmpty = docks.map(dock => this._isDockEmpty(dock.dock));

    // Find and destroy all debugger items, and the panes that contained them.
    atom.workspace.getPanes().forEach(pane => {
      pane.getItems().forEach(item => {
        if (
          item instanceof DebuggerPaneViewModel ||
          item instanceof DebuggerPaneContainerViewModel
        ) {
          // Remove the view model.
          item.setRemovedFromLayout(true);
          pane.destroyItem(item);

          // If removing the model left an empty pane, remove the pane.
          if (pane.getItems().length === 0) {
            pane.destroy();
          }
        }
      });
    });

    // If any docks became empty as a result of closing those panes, hide the dock.
    if (!performingLayout) {
      docks
        .map(dock => this._isDockEmpty(dock.dock))
        .forEach((empty, index) => {
          if (empty && !previouslyEmpty[index]) {
            docks[index].dock.hide();
          }
        });
    }

    if (this._leftPaneContainerModel != null) {
      this._leftPaneContainerModel.setRemovedFromLayout(true);
      invariant(this._leftPaneContainerModel != null);
      this._leftPaneContainerModel.dispose();
      this._leftPaneContainerModel = null;
    }

    if (this._rightPaneContainerModel != null) {
      this._rightPaneContainerModel.setRemovedFromLayout(true);
      invariant(this._rightPaneContainerModel != null);
      this._rightPaneContainerModel.dispose();
      this._rightPaneContainerModel = null;
    }

    this._debuggerVisible = false;
  }

  isDebuggerVisible(): boolean {
    return this._debuggerVisible;
  }
}
