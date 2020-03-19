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

import type {Store} from './types';
import observePaneItemVisibility from 'nuclide-commons-atom/observePaneItemVisibility';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import featureConfig from 'nuclide-commons-atom/feature-config';
import observableFromReduxStore from 'nuclide-commons/observableFromReduxStore';
import {ReplaySubject} from 'rxjs';
import FileTreeSidebarComponent from '../components/FileTreeSidebarComponent';
import * as Selectors from './redux/Selectors';
import * as Actions from './redux/Actions';

import {
  WORKSPACE_VIEW_URI,
  PREFERRED_WIDTH,
  REVEAL_FILE_ON_SWITCH_SETTING,
} from './Constants';

export default class ViewModel {
  _store: Store;
  _element: HTMLElement;
  _component: ?FileTreeSidebarComponent;
  _disposable: UniversalDisposable;
  _focusRef: ?HTMLElement;
  // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
  _disposed = new ReplaySubject(1);

  constructor(store: Store) {
    this._store = store;
    this._element = renderReactRoot(
      <FileTreeSidebarComponent
        store={this._store}
        ref={component => {
          this._component = component;
        }}
      />,
      'FileTreeRoot',
    );
    this._disposable = new UniversalDisposable(
      observePaneItemVisibility(this)
        .filter(Boolean)
        .subscribe(() => {
          // If "Reveal File on Switch" is enabled, ensure the scroll position is synced to where the
          // user expects when the side bar shows the file tree.
          if (featureConfig.get(REVEAL_FILE_ON_SWITCH_SETTING)) {
            atom.commands.dispatch(
              atom.views.getView(atom.workspace),
              'tree-view:reveal-active-file',
            );
          }
          this._store.dispatch(Actions.clearFilter());
        }),
      () => {
        this._disposed.next();
        ReactDOM.unmountComponentAtNode(this._element);
      },
    );
  }

  destroy() {
    this._disposable.dispose();
  }

  getElement() {
    return this._element;
  }

  isFocused(): boolean {
    return this._component != null && this._component.isFocused();
  }

  focus(): void {
    this._component != null && this._component.focus();
  }

  getTitle(): string {
    return Selectors.getSidebarTitle(this._store.getState());
  }

  // This is unfortunate, but Atom uses getTitle() to get the text in the tab and getPath() to get
  // the text in the tool-tip.
  getPath(): string {
    return Selectors.getSidebarPath(this._store.getState());
  }

  getDefaultLocation(): atom$PaneLocation {
    return 'left';
  }

  getAllowedLocations(): Array<atom$PaneLocation> {
    return ['left', 'right'];
  }

  getPreferredWidth(): number {
    return PREFERRED_WIDTH;
  }

  getIconName(): string {
    return 'file-directory';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  serialize(): {deserializer: string} {
    return {
      deserializer: 'nuclide.FileTreeSidebarComponent',
    };
  }

  copy(): mixed {
    // The file tree store wasn't written to support multiple instances, so try to prevent it.
    return false;
  }

  isPermanentDockItem(): boolean {
    return true;
  }

  onDidChangeTitle(callback: (v: string) => mixed): IDisposable {
    return new UniversalDisposable(
      observableFromReduxStore(this._store)
        .map(Selectors.getSidebarTitle)
        .distinctUntilChanged()
        .takeUntil(this._disposed)
        .subscribe(callback),
    );
  }

  onDidChangePath(callback: (v: ?string) => mixed): IDisposable {
    return new UniversalDisposable(
      observableFromReduxStore(this._store)
        .map(Selectors.getSidebarPath)
        .distinctUntilChanged()
        .takeUntil(this._disposed)
        .subscribe(callback),
    );
  }
}
