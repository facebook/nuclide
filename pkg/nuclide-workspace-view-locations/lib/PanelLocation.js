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

import type {PanelLocationId, SerializedPanelLocation} from './types';
import type {Viewable} from '../../nuclide-workspace-views/lib/types';

import createPaneContainer from '../../commons-atom/create-pane-container';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {SimpleModel} from '../../commons-node/SimpleModel';
import TabBarView from '../../nuclide-ui/VendorLib/atom-tabs/lib/tab-bar-view';
import addPanel from './addPanel';
import {observeAddedPaneItems} from './observeAddedPaneItems';
import {observePanes} from './observePanes';
import {syncPaneItemVisibility} from './syncPaneItemVisibility';
import * as PanelLocationIds from './PanelLocationIds';
import {PanelComponent} from './ui/PanelComponent';
import nullthrows from 'nullthrows';
import React from 'react';
import ReactDOM from 'react-dom';
import {BehaviorSubject, Observable, Scheduler} from 'rxjs';

type State = {
  showDropAreas: boolean,
  active: boolean,
};

/**
 * Manages views for an Atom panel.
 */
export class PanelLocation extends SimpleModel<State> {
  _disposables: UniversalDisposable;
  _paneContainer: atom$PaneContainer;
  _panes: BehaviorSubject<Set<atom$Pane>>;
  _panel: atom$Panel;
  _position: 'top' | 'right' | 'bottom' | 'left';
  _size: ?number;

  constructor(locationId: PanelLocationId, serializedState: Object = {}) {
    super();
    (this: any)._handlePanelResize = this._handlePanelResize.bind(this);
    const serializedData = serializedState.data || {};
    this._paneContainer = deserializePaneContainer(
      serializedData.paneContainer,
    );
    this._position = nullthrows(locationsToPosition.get(locationId));
    this._panes = new BehaviorSubject(new Set());
    this._size = serializedData.size || null;
    this.state = {
      showDropAreas: false,
      // `visible` check is for legacy compat (<= v0.206)
      active: serializedData.active === true || serializedData.visible === true,
    };
  }

  /**
   * Set up the subscriptions and make this thing "live."
   */
  initialize(): void {
    const paneContainer = this._paneContainer;

    // Create a stream that represents a change in the items of any pane. We need to do custom logic
    // for this instead of using `PaneContainer::observePaneItems()`, or the other PaneContainer
    // item events, because those [assume that moved items are not switching pane containers][1].
    // Since we have multiple pane containers, they can.
    //
    // [1]: https://github.com/atom/atom/blob/v1.10.0/src/pane-container.coffee#L232-L236
    const paneItemChanges = this._panes
      .map(x => Array.from(x))
      .switchMap(panes => {
        const itemChanges: Array<Observable<mixed>> = panes.map(pane =>
          Observable.merge(
            observableFromSubscribeFunction(pane.onDidAddItem.bind(pane)),
            observableFromSubscribeFunction(pane.onDidRemoveItem.bind(pane)),
          ),
        );
        return Observable.merge(...itemChanges);
      })
      .share();

    this._disposables = new UniversalDisposable(
      observePanes(paneContainer).subscribe(this._panes),
      syncPaneItemVisibility(
        this._panes,
        // $FlowFixMe: Teach Flow about Symbol.observable
        Observable.from(this).map(state => state.active).distinctUntilChanged(),
      ),
      // Add a tab bar to any panes created in the container.
      paneContainer.observePanes(pane => {
        const tabBarView = new TabBarView(pane);
        const paneElement = atom.views.getView(pane);
        paneElement.insertBefore(tabBarView.element, paneElement.firstChild);
        tabBarView.element.classList.add(
          'nuclide-workspace-views-panel-location-tabs',
        );
      }),
      // If you add an item to a panel (e.g. by drag & drop), make the panel active.
      paneItemChanges
        .startWith(null)
        .map(() => this._paneContainer.getPaneItems().length)
        .pairwise()
        .subscribe(([prev, next]) => {
          // If the last item is removed, hide the panel.
          if (next === 0) {
            this.setState({active: false});
          } else if (next > prev) {
            // If there are more items now than there were before, show the panel.
            this.setState({active: true});
          }
        }),
      // Show the drop areas while dragging.
      Observable.fromEvent(document, 'dragstart')
        .filter(event => isTab(event.target))
        .switchMap(() =>
          Observable.concat(
            Observable.of(true),
            Observable.merge(
              // Use the capturing phase in case the event propagation is stopped.
              Observable.fromEvent(document, 'dragend', {capture: true}),
              Observable.fromEvent(document, 'drop', {capture: true}),
            )
              .take(1)
              .mapTo(false),
          ),
        )
        // Manipulating the DOM in the dragstart handler will fire the dragend event so we defer it.
        // See https://groups.google.com/a/chromium.org/forum/?fromgroups=#!msg/chromium-bugs/YHs3orFC8Dc/ryT25b7J-NwJ
        .observeOn(Scheduler.async)
        .subscribe(showDropAreas => {
          this.setState({showDropAreas});
        }),
    );

    this._disposables.add(
      // $FlowIssue: We need to teach flow about Symbol.observable.
      Observable.from(this)
        .subscribeOn(Scheduler.animationFrame)
        .subscribe(state => {
          this._render(state);
        }),
    );
  }

  _render(state: State): void {
    const shouldBeVisible = this.state.active || this.state.showDropAreas;
    const panel = this._getPanel();

    // Because we want to show something event when the panel is collapsed, we have to show it.
    if (shouldBeVisible && !panel.isVisible()) {
      panel.show();
    }

    const el = panel.getItem();
    ReactDOM.render(
      <PanelComponent
        draggingItem={state.showDropAreas}
        active={state.active}
        initialSize={this._size}
        paneContainer={this._paneContainer}
        position={this._position}
        onResize={this._handlePanelResize}
        toggle={() => {
          this.toggle();
        }}
      />,
      el,
    );
  }

  _getPanel(): atom$Panel {
    if (this._panel == null) {
      const el = document.createElement('div');
      const panel = (this._panel = addPanel(this._position, {
        item: el,
        priority: 101, // Use a value higher than the default (100).
      }));
      this._disposables.add(
        () => {
          ReactDOM.unmountComponentAtNode(el);
        },
        () => {
          panel.destroy();
        },
      );
      this._panel = panel;
    }
    return this._panel;
  }

  _handlePanelResize(size: number): void {
    // If the user resizes the pane, store it so that we can serialize it for the next session.
    this._size = size;
  }

  itemIsVisible(item: Viewable): boolean {
    if (!this.state.active) {
      return false;
    }
    for (const pane of this._panes.getValue()) {
      if (item === pane.getActiveItem()) {
        return true;
      }
    }
    return false;
  }

  destroy(): void {
    this._disposables.dispose();
    this._paneContainer.destroy();
  }

  destroyItem(item: Object): void {
    for (const pane of this._panes.getValue()) {
      for (const it of pane.getItems()) {
        if (it === item) {
          pane.destroyItem(it);
        }
      }
    }
  }

  getItems(): Array<Viewable> {
    const items = [];
    for (const pane of this._panes.getValue()) {
      items.push(...pane.getItems());
    }
    return items;
  }

  activate(): void {
    this.setState({active: true});
  }

  addItem(item: Viewable): void {
    let pane = this._paneContainer.paneForItem(item);
    if (pane == null) {
      pane = this._paneContainer.getActivePane();
    }
    pane.addItem(item);
  }

  activateItem(item: Viewable): void {
    let pane = this._paneContainer.paneForItem(item);
    if (pane == null) {
      pane = this._paneContainer.getActivePane();
    }
    pane.activateItem(item);
  }

  /**
   * Hide the specified item. If the user toggles a active item, we hide the entire pane.
   */
  hideItem(item: Viewable): void {
    const itemIsVisible = this._paneContainer
      .getPanes()
      .some(pane => pane.getActiveItem() === item);

    // If the item's already hidden, we're done.
    if (!itemIsVisible) {
      return;
    }

    // Otherwise, hide the panel altogether.
    this.setState({active: false});
  }

  isVisible(): boolean {
    return this.state.active;
  }

  toggle(): void {
    this.setState({active: !this.state.active});
  }

  serialize(): ?SerializedPanelLocation {
    return {
      deserializer: 'PanelLocation',
      data: {
        paneContainer: this._paneContainer == null
          ? null
          : this._paneContainer.serialize(),
        size: this._size,
        active: this.state.active,
      },
    };
  }

  onDidAddItem(cb: (item: Viewable) => void): IDisposable {
    return new UniversalDisposable(
      observeAddedPaneItems(this._paneContainer).subscribe(cb),
    );
  }
}

function deserializePaneContainer(serialized: ?Object): atom$PaneContainer {
  const paneContainer = createPaneContainer();
  if (serialized != null) {
    paneContainer.deserialize(serialized, atom.deserializers);
  }
  return paneContainer;
}

const locationsToPosition = new Map([
  [PanelLocationIds.TOP_PANEL, 'top'],
  [PanelLocationIds.RIGHT_PANEL, 'right'],
  [PanelLocationIds.BOTTOM_PANEL, 'bottom'],
  [PanelLocationIds.LEFT_PANEL, 'left'],
]);

function isTab(element: HTMLElement): boolean {
  let el = element;
  while (el != null) {
    if (el.getAttribute('is') === 'tabs-tab') {
      return true;
    }
    el = el.parentElement;
  }
  return false;
}
