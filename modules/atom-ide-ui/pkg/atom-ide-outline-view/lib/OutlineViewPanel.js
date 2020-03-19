/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {OutlineForUi} from './createOutlines';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import * as React from 'react';

import observePaneItemVisibility from 'nuclide-commons-atom/observePaneItemVisibility';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {OutlineView} from './OutlineView';
import {Observable} from 'rxjs';

export const WORKSPACE_VIEW_URI = 'atom://nuclide/outline-view';

export type SerializedOutlineViewPanelState = {
  deserializer: 'atom-ide-ui.OutlineViewPanelState',
};

export class OutlineViewPanelState {
  _outlines: Observable<OutlineForUi>;

  constructor(outlines: Observable<OutlineForUi>) {
    this._outlines = outlines;
  }

  destroy(): void {}

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

  getElement(): HTMLElement {
    const BoundOutlineView = bindObservableAsProps(
      observePaneItemVisibility(this).switchMap(visible => {
        const outlines = visible
          ? this._outlines
          : Observable.of({kind: 'empty'});
        return outlines.map(outline => ({outline, visible}));
      }),
      OutlineView,
    );
    return renderReactRoot(<BoundOutlineView />, 'OutlineViewRoot');
  }

  serialize(): SerializedOutlineViewPanelState {
    return {
      deserializer: 'atom-ide-ui.OutlineViewPanelState',
    };
  }
}
