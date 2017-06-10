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

/**
 * A small compatibilty stub for interop with Nuclide, which still supports Atom 1.16.
 * For Atom 1.17+ this just uses the native Atom APIs.
 * TODO(matthewwithanm): Delete this and refactor to workspace
 * API once Nuclide uses 1.17.
 */

import {Disposable} from 'atom';
import semver from 'semver';

/**
 * The object used as items in locations. This is based on the supported interface for items in Atom
 * panes. That way, we maintain compatibility with Atom (upstream?) and can put them in panes as-is.
 *
 * The truth is that these models can have any methods they want. Packages define ad-hoc protocols
 * and check to see if the item implements them. For example, atom-tabs will call `getIconName()` if
 * it exists. We have some of our own optional methods which, for clarity's sake, are defined here,
 * even though they're only used by some of our location packages.
 *
 * IMPORTANT: All properties and methods must be optional so that we maintain compatibility with
 * non-nuclide items.
 */
export type Viewable = atom$PaneItem & {
  // Used by PanelLocation to get an initial size for the panel.
  +getPreferredHeight?: () => number,
  +getPreferredWidth?: () => number,
  +didChangeVisibility?: (visible: boolean) => void,
  +getDefaultLocation?: () => string,
};

export type Opener = (uri: string) => ?Viewable;

export type OpenOptions = {
  activateItem?: boolean,
  activateLocation?: boolean,
  searchAllPanes?: boolean,
};

export type Location = {
  activate(): void,
  activateItem(item: Object): void,
  addItem(item: Object): void,
  destroy(): void,
  destroyItem(item: Object): void,
  getItems(): Array<Viewable>,
  hideItem(item: Viewable): void,
  itemIsVisible(item: Viewable): boolean,
  serialize(): ?Object,

  onDidAddItem(cb: (item: Viewable) => void): IDisposable,
};

export type LocationFactory = {
  id: string,
  create(serializedState: ?Object): Location,
};

export type ToggleOptions = {
  visible?: ?boolean,
};

export type WorkspaceViewsService = {
  addOpener(opener: Opener): IDisposable,
  destroyWhere(predicate: (item: Viewable) => boolean): void,
  open(uri: string, options?: OpenOptions): void,
  registerLocation(factory: LocationFactory): IDisposable,
  toggle(uri: string, options?: ToggleOptions): void,
};

export function getDocksWorkspaceViewsService() {
  return {
    registerLocation: () => new Disposable(() => {}),
    addOpener: opener => atom.workspace.addOpener(opener),
    destroyWhere(predicate: (item: Viewable) => boolean) {
      atom.workspace.getPanes().forEach(pane => {
        pane.getItems().forEach(item => {
          if (predicate(item)) {
            pane.destroyItem(item, true);
          }
        });
      });
    },
    open(uri: string, options?: Object): void {
      // eslint-disable-next-line nuclide-internal/atom-apis
      atom.workspace.open(uri, options);
    },
    toggle(uri: string, options?: ?ToggleOptions): void {
      const visible = options && options.visible;
      if (visible === true) {
        // eslint-disable-next-line nuclide-internal/atom-apis
        atom.workspace.open(uri, {searchAllPanes: true});
      } else if (visible === false) {
        // TODO(jxg) remove this once Atom 1.17 lands.
        if (typeof atom.workspace.hide === 'function') {
          // Atom version >=1.17
          atom.workspace.hide(uri);
        } else {
          // Atom version <1.17
          const hasItem = atom.workspace
            .getPaneItems()
            .some(
              item =>
                typeof item.getURI === 'function' && item.getURI() === uri,
            );
          if (hasItem) {
            // TODO(matthewwithanm): Add this to the Flow defs once docks land
            // $FlowIgnore
            atom.workspace.toggle(uri);
          }
        }
      } else {
        // TODO(matthewwithanm): Add this to the Flow defs once docks land
        // $FlowIgnore
        atom.workspace.toggle(uri);
      }
    },
  };
}

export function consumeWorkspaceViewsCompat(
  callback: (service: WorkspaceViewsService) => IDisposable,
): IDisposable {
  if (semver.gte(atom.getVersion(), '1.17.0')) {
    callback(getDocksWorkspaceViewsService());
    return new Disposable();
  }
  return atom.packages.serviceHub.consume(
    'nuclide.workspace-views',
    '0.0.0',
    callback,
  );
}
