'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {FileTreeControllerState} from './FileTreeController';
import type FileTreeContextMenu from './FileTreeContextMenu';
import type {NuclideSideBarService} from '../../nuclide-side-bar';
import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';
import type {RemoteProjectsService} from '../../nuclide-remote-projects';

import {Disposable, CompositeDisposable} from 'atom';
import invariant from 'assert';

import featureConfig from '../../commons-atom/featureConfig';
import debounce from '../../commons-node/debounce';

import FileTreeSidebarComponent from '../components/FileTreeSidebarComponent';
import FileTreeController from './FileTreeController';
import {WorkingSet} from '../../nuclide-working-sets-common';
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/types';

/**
 * Minimum interval (in ms) between onChangeActivePaneItem events before revealing the active pane
 * item in the file tree.
 */
const OPEN_FILES_UPDATE_DEBOUNCE_INTERVAL_MS = 150;

const REVEAL_FILE_ON_SWITCH_SETTING = 'nuclide-file-tree.revealFileOnSwitch';

class Activation {
  _cwdApiSubscription: ?IDisposable;
  _fileTreeController: FileTreeController;
  _packageState: ?FileTreeControllerState;
  _subscriptions: CompositeDisposable;
  _paneItemSubscription: ?IDisposable;

  constructor(state: ?FileTreeControllerState) {
    this._packageState = state;
    this._subscriptions = new CompositeDisposable();

    this._fileTreeController = new FileTreeController(this._packageState);

    const excludeVcsIgnoredPathsSetting = 'core.excludeVcsIgnoredPaths';
    const hideIgnoredNamesSetting = 'nuclide-file-tree.hideIgnoredNames';
    const ignoredNamesSetting = 'core.ignoredNames';
    const prefixKeyNavSetting = 'nuclide-file-tree.allowKeyboardPrefixNavigation';
    const allowPendingPaneItems = 'core.allowPendingPaneItems';

    this._subscriptions.add(
      this._fixContextMenuHighlight(),
      featureConfig.observe(prefixKeyNavSetting, (x: any) => this._setPrefixKeyNavSetting(x)),
      featureConfig.observe(
        REVEAL_FILE_ON_SWITCH_SETTING,
        (x: any) => this._setRevealOnFileSwitch(x),
      ),
      atom.config.observe(ignoredNamesSetting, (x: any) => this._setIgnoredNames(x)),
      featureConfig.observe(hideIgnoredNamesSetting, (x: any) => this._setHideIgnoredNames(x)),
      atom.config.observe(
        excludeVcsIgnoredPathsSetting,
        this._setExcludeVcsIgnoredPaths.bind(this),
      ),
      atom.config.observe(allowPendingPaneItems, this._setUsePreviewTabs.bind(this)),
    );
  }

  _fixContextMenuHighlight(): IDisposable {
    // Giant hack to fix the context menu highlight
    // For explanation, see https://github.com/atom/atom/pull/13266

    const showForEvent = (atom.contextMenu: any).showForEvent;
    (atom.contextMenu: any).showForEvent = function(event) {
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() =>
            showForEvent.call(atom.contextMenu, event),
          ),
        ),
      );
    };

    return new Disposable(() => {
      (atom.contextMenu: any).showForEvent = showForEvent;
    });
  }

  consumeCwdApi(cwdApi: CwdApi): IDisposable {
    invariant(this._fileTreeController);
    if (this._cwdApiSubscription != null) {
      this._cwdApiSubscription.dispose();
    }
    const controller = this._fileTreeController;
    controller.setCwdApi(cwdApi);
    this._cwdApiSubscription = new Disposable(() => controller.setCwdApi(null));
    return this._cwdApiSubscription;
  }

  consumeRemoteProjectsService(service: RemoteProjectsService): IDisposable {
    const controller = this._fileTreeController;
    controller.setRemoteProjectsService(service);
    return new Disposable(() => {
      controller.setRemoteProjectsService(null);
    });
  }

  dispose() {
    this._deactivate();
    this._subscriptions.dispose();
  }

  serialize(): ?FileTreeControllerState {
    return this._fileTreeController.serialize();
  }

  consumeWorkingSetsStore(workingSetsStore: WorkingSetsStore): ?IDisposable {
    this._fileTreeController.updateWorkingSetsStore(workingSetsStore);
    this._fileTreeController.updateWorkingSet(workingSetsStore.getCurrent());

    const currentSubscription = workingSetsStore.subscribeToCurrent(currentWorkingSet => {
      this._fileTreeController.updateWorkingSet(currentWorkingSet);
    });
    this._subscriptions.add(currentSubscription);


    let updateOpenFilesWorkingSet = this._fileTreeController.updateOpenFilesWorkingSet.bind(
      this._fileTreeController,
    );

    this._subscriptions.add(new Disposable(() => {
      updateOpenFilesWorkingSet = () => {};
    }));

    const rebuildOpenFilesWorkingSet = debounce(
      () => {
        const openUris = atom.workspace.getTextEditors()
          .filter(te => te.getPath() != null && te.getPath() !== '')
          .map(te => (te.getPath(): any));
        const openFilesWorkingSet = new WorkingSet(openUris);
        updateOpenFilesWorkingSet(openFilesWorkingSet);
      },
      OPEN_FILES_UPDATE_DEBOUNCE_INTERVAL_MS,
    );

    rebuildOpenFilesWorkingSet();

    const paneObservingDisposable = new CompositeDisposable();
    paneObservingDisposable.add(atom.workspace.onDidAddPaneItem(rebuildOpenFilesWorkingSet));
    paneObservingDisposable.add(atom.workspace.onDidDestroyPaneItem(rebuildOpenFilesWorkingSet));

    this._subscriptions.add(paneObservingDisposable);

    return new Disposable(() => {
      this._fileTreeController.updateWorkingSetsStore(null);
      this._fileTreeController.updateWorkingSet(new WorkingSet());
      this._fileTreeController.updateOpenFilesWorkingSet(new WorkingSet());
      paneObservingDisposable.dispose();
      this._subscriptions.remove(currentSubscription);
      currentSubscription.dispose();
    });
  }

  _setExcludeVcsIgnoredPaths(excludeVcsIgnoredPaths: boolean): void {
    this._fileTreeController.setExcludeVcsIgnoredPaths(excludeVcsIgnoredPaths);
  }

  _setHideIgnoredNames(hideIgnoredNames: boolean): void {
    this._fileTreeController.setHideIgnoredNames(hideIgnoredNames);
  }

  _setIgnoredNames(ignoredNames: string | Array<string>) {
    let normalizedIgnoredNames;
    if (ignoredNames === '') {
      normalizedIgnoredNames = [];
    } else if (typeof ignoredNames === 'string') {
      normalizedIgnoredNames = [ignoredNames];
    } else {
      normalizedIgnoredNames = ignoredNames;
    }
    this._fileTreeController.setIgnoredNames(normalizedIgnoredNames);
  }

  _setRevealOnFileSwitch(shouldReveal: boolean) {
    if (shouldReveal) {
      // Guard against this getting called multiple times
      if (!this._paneItemSubscription) {
        this._paneItemSubscription = atom.workspace.onDidStopChangingActivePaneItem(
          this._fileTreeController.revealActiveFile.bind(
            this._fileTreeController,
            /* showIfHidden */ false,
          ),
        );
        this._subscriptions.add(this._paneItemSubscription);
      }
    } else {
      // Use a local so Flow can refine the type.
      const paneItemSubscription = this._paneItemSubscription;
      if (paneItemSubscription) {
        this._subscriptions.remove(paneItemSubscription);
        paneItemSubscription.dispose();
        this._paneItemSubscription = null;
      }
    }
  }

  _setPrefixKeyNavSetting(usePrefixNav: ?boolean): void {
    // config is void during startup, signifying no config yet
    if (usePrefixNav == null || !this._fileTreeController) {
      return;
    }
    this._fileTreeController.setUsePrefixNav(usePrefixNav);
  }

  _setUsePreviewTabs(usePreviewTabs: ?boolean): void {
    // config is void during startup, signifying no config yet
    if (usePreviewTabs == null) {
      return;
    }
    this._fileTreeController.setUsePreviewTabs(usePreviewTabs);
  }

  getContextMenu(): FileTreeContextMenu {
    invariant(this._fileTreeController);
    return this._fileTreeController.getContextMenu();
  }

  _deactivate() {
    // Guard against deactivate being called twice
    this._fileTreeController.destroy();
  }
}

let activation: ?Activation;
let deserializedState: ?FileTreeControllerState;
let onDidActivateDisposable: IDisposable;
let sideBarDisposable: ?IDisposable;

function disableTreeViewPackage() {
  if (!atom.packages.isPackageDisabled('tree-view')) {
    // Calling `disablePackage` on a package first *loads* the package. This step must come
    // before calling `unloadPackage`.
    atom.packages.disablePackage('tree-view');
  }

  if (atom.packages.isPackageActive('tree-view')) {
    // Only *inactive* packages can be unloaded. Attempting to unload an active package is
    // considered an exception. Deactivating must come before unloading.
    atom.packages.deactivatePackage('tree-view');
  }

  if (atom.packages.isPackageLoaded('tree-view')) {
    atom.packages.unloadPackage('tree-view');
  }
}

export function activate(state: ?FileTreeControllerState): void {
  invariant(activation == null);
  // Disable Atom's bundled 'tree-view' package. If this activation is happening during the
  // normal startup activation, the `onDidActivateInitialPackages` handler below must unload the
  // 'tree-view' because it will have been loaded during startup.
  disableTreeViewPackage();

  // Disabling and unloading Atom's bundled 'tree-view' must happen after activation because this
  // package's `activate` is called during an traversal of all initial packages to activate.
  // Disabling a package during the traversal has no effect if this is a startup load because
  // `PackageManager` does not re-load the list of packages to activate after each iteration.
  onDidActivateDisposable = atom.packages.onDidActivateInitialPackages(() => {
    disableTreeViewPackage();
    onDidActivateDisposable.dispose();
  });

  deserializedState = state;
  activation = new Activation(deserializedState);
}

export function deactivate() {
  // Re-enable Atom's bundled 'tree-view' when this package is disabled to leave the user's
  // environment the way this package found it.
  if (featureConfig.isFeatureDisabled('nuclide-file-tree')
    && atom.packages.isPackageDisabled('tree-view')) {
    atom.packages.enablePackage('tree-view');
  }

  if (sideBarDisposable != null) {
    sideBarDisposable.dispose();
  }

  if (!onDidActivateDisposable.disposed) {
    onDidActivateDisposable.dispose();
  }

  if (activation) {
    activation.dispose();
    activation = null;
  }
}

export function serialize(): ?FileTreeControllerState {
  if (activation) {
    return activation.serialize();
  }
}

export function getContextMenuForFileTree(): FileTreeContextMenu {
  invariant(activation);
  return activation.getContextMenu();
}

export function consumeNuclideSideBar(sidebar: NuclideSideBarService): IDisposable {
  invariant(activation);

  sidebar.registerView({
    getComponent() { return FileTreeSidebarComponent; },
    onDidShow() {
      // If "Reveal File on Switch" is enabled, ensure the scroll position is synced to where the
      // user expects when the side bar shows the file tree.
      if (featureConfig.get(REVEAL_FILE_ON_SWITCH_SETTING)) {
        atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          'nuclide-file-tree:reveal-active-file',
        );
      }
    },
    title: 'File Tree',
    toggleCommand: 'nuclide-file-tree:toggle',
    viewId: 'nuclide-file-tree',
  });

  sideBarDisposable = new Disposable(() => {
    sidebar.destroyView('nuclide-file-tree');
  });

  return sideBarDisposable;
}

export function consumeWorkingSetsStore(workingSetsStore: WorkingSetsStore): ?IDisposable {
  invariant(activation);

  return activation.consumeWorkingSetsStore(workingSetsStore);
}

export function consumeCwdApi(cwdApi: CwdApi): IDisposable {
  invariant(activation);
  return activation.consumeCwdApi(cwdApi);
}

export function consumeRemoteProjectsService(service: RemoteProjectsService): IDisposable {
  invariant(activation);
  return activation.consumeRemoteProjectsService(service);
}
