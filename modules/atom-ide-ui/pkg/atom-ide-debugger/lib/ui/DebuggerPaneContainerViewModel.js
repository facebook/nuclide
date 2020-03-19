/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import {
  DEBUGGER_PANELS_DEFAULT_WIDTH_PX,
  DEBUGGER_PANELS_DEFAULT_LOCATION,
} from '../constants';
import DebuggerPaneViewModel from './DebuggerPaneViewModel';
import invariant from 'assert';
import * as React from 'react';
import TabBarView from 'nuclide-commons-ui/VendorLib/atom-tabs/lib/tab-bar-view';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {View} from 'nuclide-commons-ui/View';

const DEBUGGER_TAB_TITLE = 'Debugger';

export default class DebuggerPaneContainerViewModel {
  _container: atom$PaneContainer;
  _disposables: UniversalDisposable;
  _paneEvents: Map<atom$Pane, UniversalDisposable>;
  _removedFromLayout: boolean;
  _preferredWidth: ?number;

  constructor(paneContainer: atom$PaneContainer, preferredWidth: ?number) {
    this._disposables = new UniversalDisposable();
    this._paneEvents = new Map();
    this._removedFromLayout = false;
    this._container = paneContainer;
    this._preferredWidth = preferredWidth;

    for (const pane of this._container.getPanes()) {
      this._deferredAddTabBarToEmptyPane(pane);
      this._addManagedPane(pane);
    }

    this._disposables.add(
      () => {
        this._forEachChildPaneItem((item: atom$PaneItem) => {
          invariant(
            item instanceof DebuggerPaneViewModel ||
              item instanceof DebuggerPaneContainerViewModel,
          );
          item.setRemovedFromLayout(this._removedFromLayout);
          item.destroy();
        });
        this._container.destroy();
      },
      paneContainer.onDidAddPane(event => {
        const pane = event.pane;

        this._kickOutNonDebuggerItems(pane);
        if (this._container.getPanes().indexOf(pane) < 0) {
          return;
        }

        if (!this._conditionallyAddTabBarToPane(pane)) {
          // Wait until the item(s) are added to the pane, and then add a tab bar
          // above them if and only if the item's title is not the same as the
          // container tabs title (we don't want duplicate tabs right beneath each other).
          this._deferredAddTabBarToEmptyPane(pane);
        }

        this._addManagedPane(pane);
      }),
      paneContainer.onWillDestroyPane(event => {
        const disposables = this._paneEvents.get(event.pane);
        if (disposables != null) {
          disposables.dispose();
          this._paneEvents.delete(event.pane);
        }
      }),
      paneContainer.onDidDestroyPane(event => {
        // If this container is now empty, destroy it!
        const panes = this._container.getPanes();
        if (
          panes.length === 0 ||
          (panes.length === 1 && panes[0].getItems().length === 0)
        ) {
          const parent = this.getParentPane();
          if (parent != null) {
            parent.removeItem(this);
          }
        }
      }),
    );
  }

  _addManagedPane(pane: atom$Pane): void {
    let disposables = this._paneEvents.get(pane);
    if (disposables == null) {
      disposables = new UniversalDisposable();
      this._paneEvents.set(pane, disposables);
    }

    disposables.add(
      pane.onDidAddItem(event => {
        this._kickOutNonDebuggerItems(pane);
      }),
    );

    // Split operations on the child panes of this container are also being
    // executed on the parent pane that contains this container, which results
    // in very unexpected behavior. Prevent the parent pane from splitting.
    const parent = this.getParentPane();
    if (parent != null) {
      // $FlowFixMe
      parent.split = () => {};
    }
  }

  // If a pane is initially empty, don't add the tab bar until the first item
  // is added to the pane, otherwise we don't know what title to give the tab!
  _deferredAddTabBarToEmptyPane(pane: atom$Pane): void {
    const pendingAddTabDisposable = new UniversalDisposable();
    pendingAddTabDisposable.add(
      pane.onDidAddItem(event => {
        if (this._conditionallyAddTabBarToPane(pane)) {
          this._disposables.remove(pendingAddTabDisposable);
          pendingAddTabDisposable.dispose();
        }
      }),
    );
    this._disposables.add(pendingAddTabDisposable);
  }

  _conditionallyAddTabBarToPane(pane: atom$Pane): boolean {
    const items = pane.getItems();
    if (items.length > 0) {
      const item = items[0];
      if (item instanceof DebuggerPaneViewModel) {
        if (item.getTitle() !== this.getTitle() || items.length > 1) {
          this._addTabBarToPane(pane);
          return true;
        }
      }
    }

    return false;
  }

  // Don't let the user add a non-debugger item to the debugger pane container. This is because
  // the container will get destroyed by the debugger going away or redoing layout, and we wouldn't
  // be able to preserve the user's other items.
  _kickOutNonDebuggerItems(pane: atom$Pane): void {
    for (const item of pane.getItems()) {
      if (item instanceof DebuggerPaneContainerViewModel) {
        if (item === this) {
          // If the container is dropped into itself, we've got a problem.
          // Call debugger:show, which will blow away this entire pane and redo
          // the debugger layout.
          // TODO: Better solution here.
          process.nextTick(() => {
            atom.commands.dispatch(
              atom.views.getView(atom.workspace),
              'debugger:show',
            );
          });
        } else {
          // This is another debugger pane container, which contains other debugger
          // panes. Move all the other container's items to this container, and\
          // then destroy the other container.
          const otherPanes = item._container.getPanes();
          for (const otherPane of otherPanes) {
            for (const otherItem of otherPane.getItems()) {
              const idx = pane.getItems().indexOf(item);
              otherPane.moveItemToPane(otherItem, pane, idx);
              otherPane.activateItemAtIndex(idx);
            }
          }

          // Destroy the (now empty) other pane container.
          process.nextTick(() => {
            pane.destroyItem(item);
          });
        }
      } else {
        // Kick the item out to the parent pane.
        if (!(item instanceof DebuggerPaneViewModel)) {
          this._moveItemToParentPane(item, pane);
        }
      }
    }
  }

  _moveItemToParentPane(item: atom$PaneItem, pane: atom$Pane): void {
    const parentPane = this.getParentPane();
    invariant(parentPane != null);

    // Kick the item out to the parent pane, which must be done on next tick because the drag
    // operation currently in progress needs the item not to be destroyed before the drag
    // completes.
    process.nextTick(() => {
      invariant(parentPane != null);
      pane.moveItemToPane(
        item,
        parentPane,
        parentPane.getItems().indexOf(this) + 1,
      );

      // TODO: Atom bug? This is here because when setting this item active immediately after
      // moving, it sometimes (but not always) renders a blank pane...
      process.nextTick(() => {
        invariant(parentPane != null);
        parentPane.setActiveItem(item);
      });
    });
  }

  getParentPane(): ?atom$Pane {
    for (const pane of atom.workspace.getPanes()) {
      for (const item of pane.getItems()) {
        if (item === this) {
          return pane;
        }
      }
    }
    return null;
  }

  _addTabBarToPane(pane: atom$Pane): void {
    const tabBarView = new TabBarView(pane);
    const paneElement = atom.views.getView(pane);
    paneElement.insertBefore(tabBarView.element, paneElement.firstChild);

    // moveItemBetweenPanes conflicts with the parent tab's moveItemBetweenPanes.
    // Empty it out to get the correct behavior.
    tabBarView.moveItemBetweenPanes = () => {};
    tabBarView.element.classList.add(
      'nuclide-workspace-views-panel-location-tabs',
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  destroy(): void {
    if (!this._removedFromLayout) {
      // We need to differentiate between the case where destroying this pane hides one or more
      // non-essential debugger views, and where it means the user is closing the debugger.
      //
      // If closing this pane would close a lifetime view, forward the destroy request to that view,
      // which will manage tearing down the debugger. Otherwise, we are simply hiding all panes
      // contained within this pane, which is accomplished by disposing this.
      for (const pane of this._container.getPanes()) {
        for (const item of pane.getItems()) {
          if (item instanceof DebuggerPaneViewModel) {
            if (item.isLifetimeView()) {
              item.destroy();
              return;
            }
          }
        }
      }
    }

    this.dispose();
  }

  destroyWhere(callback: (item: atom$PaneItem) => mixed) {
    this._forEachChildPaneItem((innerItem, pane) => {
      if (callback(innerItem)) {
        pane.destroyItem(innerItem);
      }
    });
  }

  getTitle(): string {
    return DEBUGGER_TAB_TITLE;
  }

  getIconName(): string {
    return 'nuclicon-debugger';
  }

  getDefaultLocation(): string {
    return DEBUGGER_PANELS_DEFAULT_LOCATION;
  }

  getURI(): string {
    return 'atom://nuclide/debugger-container';
  }

  getPreferredWidth(): number {
    return this._preferredWidth == null
      ? DEBUGGER_PANELS_DEFAULT_WIDTH_PX
      : this._preferredWidth;
  }

  createView(): React.Element<any> {
    return <View item={this._container} />;
  }

  setRemovedFromLayout(removed: boolean): void {
    this._removedFromLayout = removed;

    // Propagate this command to the children of the pane container.
    this._forEachChildPaneItem(item => {
      if (item instanceof DebuggerPaneViewModel) {
        item.setRemovedFromLayout(removed);
      }
    });
  }

  _forEachChildPaneItem(
    callback: (item: atom$PaneItem, pane: atom$Pane) => void,
  ): void {
    for (const pane of this._container.getPanes()) {
      pane.getItems().forEach(item => {
        callback(item, pane);
      });
    }
  }

  getAllItems(): Array<atom$PaneItem> {
    const items = [];
    this._forEachChildPaneItem(item => {
      items.push(item);
    });

    return items;
  }

  serialize(): Object {
    return {};
  }

  copy(): boolean {
    return false;
  }
}
