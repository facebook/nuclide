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

import type {OutlineForUi} from './createOutlines';

import * as React from 'react';

import observePaneItemVisibility from 'nuclide-commons-atom/observePaneItemVisibility';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {OutlineView} from './OutlineView';
import {BehaviorSubject, Observable} from 'rxjs';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/outline-view';

export type SerializedOutlineViewPanelState = {
  deserializer: 'atom-ide-ui.OutlineViewPanelState',
};

export class OutlineViewPanelState {
  _outlines: Observable<OutlineForUi>;
  _visibility: BehaviorSubject<boolean>;
  _visibilitySubscription: rxjs$ISubscription;

  constructor(outlines: Observable<OutlineForUi>) {
    this._outlines = outlines;
    // TODO(T17495163)
    this._visibility = new BehaviorSubject(true);
    this._visibilitySubscription = observePaneItemVisibility(
      this,
    ).subscribe(visible => {
      this.didChangeVisibility(visible);
    });
  }

  destroy(): void {
    this._visibilitySubscription.unsubscribe();
  }

  getTitle() {
    return 'Outline';
  }

  getIconName() {
    return 'list-unordered';
  }

  getPreferredWidth(): number {
    return 300;
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  getDefaultLocation(): string {
    return 'right';
  }

  didChangeVisibility(visible: boolean): void {
    this._visibility.next(visible);
  }

  getElement(): HTMLElement {
    const outlines = this._visibility.switchMap(
      visible => (visible ? this._outlines : Observable.of({kind: 'empty'})),
    );
    return renderReactRoot(
      <OutlineView
        outlines={outlines}
        visibility={this._visibility.distinctUntilChanged()}
      />,
    );
  }

  serialize(): SerializedOutlineViewPanelState {
    return {
      deserializer: 'atom-ide-ui.OutlineViewPanelState',
    };
  }
}
