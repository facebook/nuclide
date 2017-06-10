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

import type {FileTreeProjectSelectionManager} from './FileTreeController';
import type FileTreeContextMenu from './FileTreeContextMenu';
import type {ExportStoreData} from './FileTreeStore';
import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';
import type {RemoteProjectsService} from '../../nuclide-remote-projects';
import type {
  WorkspaceViewsService,
} from '../../nuclide-workspace-views/lib/types';
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/types';

import invariant from 'assert';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import featureConfig from 'nuclide-commons-atom/feature-config';
import disablePackage from '../../commons-atom/disablePackage';
import {
  viewableFromReactElement,
} from '../../commons-atom/viewableFromReactElement';
import {observeTextEditors} from 'nuclide-commons-atom/text-editor';
import {nextAnimationFrame} from 'nuclide-commons/observable';

import FileTreeSidebarComponent from '../components/FileTreeSidebarComponent';
import FileTreeController from './FileTreeController';
import {WorkingSet} from '../../nuclide-working-sets-common';
import {REVEAL_FILE_ON_SWITCH_SETTING, WORKSPACE_VIEW_URI} from './Constants';
import React from 'react';
import {Observable} from 'rxjs';

type SerializedState = {
  tree: ExportStoreData,
  restored: ?boolean,
};

/**
 * Minimum interval (in ms) between onChangeActivePaneItem events before revealing the active pane
 * item in the file tree.
 */
const OPEN_FILES_UPDATE_DEBOUNCE_INTERVAL_MS = 150;

const DESERIALIZER_VERSION = atom.workspace.getLeftDock == null ? 1 : 2;

class Activation {
  _didActivateDisposable: IDisposable;
  _cwdApiSubscription: ?IDisposable;
  _fileTreeController: FileTreeController;
  _fileTreeComponent: ?FileTreeSidebarComponent;
  _restored: boolean; // Has the package state been restored from a previous session?
  _disposables: UniversalDisposable;
  _paneItemSubscription: ?IDisposable;

  constructor(rawState: ?SerializedState) {
    let state = rawState || {};
    const serializedVersionMatches =
      (state.version || 1) === DESERIALIZER_VERSION;
    if (!serializedVersionMatches) {
      state = {};
    }

    this._disposables = new UniversalDisposable(
      disablePackage('tree-view'),
      () => {
        this._fileTreeController.destroy();
      },
    );

    this._fileTreeController = new FileTreeController(
      state == null ? null : state.tree,
    );
    this._restored = state.restored === true;

    const excludeVcsIgnoredPathsSetting = 'core.excludeVcsIgnoredPaths';
    const hideIgnoredNamesSetting = 'nuclide-file-tree.hideIgnoredNames';
    const ignoredNamesSetting = 'core.ignoredNames';
    const prefixKeyNavSetting =
      'nuclide-file-tree.allowKeyboardPrefixNavigation';
    const allowPendingPaneItems = 'core.allowPendingPaneItems';

    this._disposables.add(
      this._fixContextMenuHighlight(),
      featureConfig.observe(prefixKeyNavSetting, (x: any) =>
        this._setPrefixKeyNavSetting(x),
      ),
      featureConfig.observe(REVEAL_FILE_ON_SWITCH_SETTING, (x: any) =>
        this._setRevealOnFileSwitch(x),
      ),
      atom.config.observe(ignoredNamesSetting, (x: any) =>
        this._setIgnoredNames(x),
      ),
      featureConfig.observe(hideIgnoredNamesSetting, (x: any) =>
        this._setHideIgnoredNames(x),
      ),
      atom.config.observe(
        excludeVcsIgnoredPathsSetting,
        this._setExcludeVcsIgnoredPaths.bind(this),
      ),
      atom.config.observe(
        allowPendingPaneItems,
        this._setUsePreviewTabs.bind(this),
      ),
      atom.commands.add(
        'atom-workspace',
        'nuclide-file-tree:toggle-focus',
        () => {
          const component = this._fileTreeComponent;
          if (component == null) {
            return;
          }
          if (component.isFocused()) {
            // Focus the center.
            const center = atom.workspace.getCenter
              ? atom.workspace.getCenter()
              : atom.workspace;
            center.getActivePane().activate();
          } else {
            // Focus the file tree.
            component.focus();
          }
        },
      ),
    );
  }

  _fixContextMenuHighlight(): IDisposable {
    // Giant hack to fix the context menu highlight
    // For explanation, see https://github.com/atom/atom/pull/13266

    const {showForEvent} = atom.contextMenu;
    const disposables = new UniversalDisposable(() => {
      (atom.contextMenu: any).showForEvent = showForEvent;
    });
    // $FlowIgnore: Undocumented API
    atom.contextMenu.showForEvent = function(event) {
      // $FlowFixMe: Add repeat() to type def
      const sub = nextAnimationFrame.repeat(3).last().subscribe(() => {
        showForEvent.call(atom.contextMenu, event);
        disposables.remove(sub);
      });
      disposables.add(sub);
    };

    return disposables;
  }

  consumeCwdApi(cwdApi: CwdApi): IDisposable {
    invariant(this._fileTreeController);
    if (this._cwdApiSubscription != null) {
      this._cwdApiSubscription.dispose();
    }
    const controller = this._fileTreeController;
    controller.setCwdApi(cwdApi);
    this._cwdApiSubscription = new UniversalDisposable(() =>
      controller.setCwdApi(null),
    );
    return this._cwdApiSubscription;
  }

  consumeRemoteProjectsService(service: RemoteProjectsService): IDisposable {
    const controller = this._fileTreeController;
    controller.setRemoteProjectsService(service);
    return new UniversalDisposable(() => {
      controller.setRemoteProjectsService(null);
    });
  }

  dispose() {
    this._disposables.dispose();
  }

  serialize(): ?SerializedState {
    return {
      tree: this._fileTreeController.serialize(),
      restored: true,
      // Scrap our serialization when docks become available. Technically, we only need to scrap
      // the "restored" value, but this is simpler.
      // TODO(matthewwithanm): After docks have been in Atom stable for a while, we can just change
      //   this to "2"
      version: atom.workspace.getLeftDock == null ? 1 : 2,
    };
  }

  consumeWorkingSetsStore(workingSetsStore: WorkingSetsStore): ?IDisposable {
    this._fileTreeController.updateWorkingSetsStore(workingSetsStore);
    this._fileTreeController.updateWorkingSet(workingSetsStore.getCurrent());

    const currentSubscription = workingSetsStore.subscribeToCurrent(
      currentWorkingSet => {
        this._fileTreeController.updateWorkingSet(currentWorkingSet);
      },
    );
    this._disposables.add(currentSubscription);

    const rebuildSignals = Observable.merge(
      Observable.of(null), // None of the subscriptions below will trigger at startup.
      observableFromSubscribeFunction(
        atom.workspace.onDidAddPaneItem.bind(atom.workspace),
      ),
      observableFromSubscribeFunction(
        atom.workspace.onDidDestroyPaneItem.bind(atom.workspace),
      ),
      observableFromSubscribeFunction(
        observeTextEditors,
      ).flatMap(textEditor => {
        return observableFromSubscribeFunction(
          textEditor.onDidChangePath.bind(textEditor),
        ).takeUntil(
          observableFromSubscribeFunction(
            textEditor.onDidDestroy.bind(textEditor),
          ),
        );
      }),
    ).debounceTime(OPEN_FILES_UPDATE_DEBOUNCE_INTERVAL_MS);

    this._disposables.add(
      rebuildSignals.subscribe(() => {
        const openUris = atom.workspace
          .getTextEditors()
          .filter(te => te.getPath() != null && te.getPath() !== '')
          .map(te => (te.getPath(): any));
        const openFilesWorkingSet = new WorkingSet(openUris);
        this._fileTreeController.updateOpenFilesWorkingSet(openFilesWorkingSet);
      }),
    );

    return new UniversalDisposable(() => {
      this._fileTreeController.updateWorkingSetsStore(null);
      this._fileTreeController.updateWorkingSet(new WorkingSet());
      this._fileTreeController.updateOpenFilesWorkingSet(new WorkingSet());
      this._disposables.remove(currentSubscription);
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
        this._disposables.add(this._paneItemSubscription);
      }
    } else {
      // Use a local so Flow can refine the type.
      const paneItemSubscription = this._paneItemSubscription;
      if (paneItemSubscription) {
        this._disposables.remove(paneItemSubscription);
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

  getContextMenuForFileTree(): FileTreeContextMenu {
    invariant(this._fileTreeController);
    return this._fileTreeController.getContextMenu();
  }

  getProjectSelectionManagerForFileTree(): FileTreeProjectSelectionManager {
    invariant(this._fileTreeController);
    return this._fileTreeController.getProjectSelectionManager();
  }

  _createView(): FileTreeSidebarComponent {
    // Currently, we assume that only one will be created.
    this._fileTreeComponent = viewableFromReactElement(
      <FileTreeSidebarComponent />,
    );
    return this._fileTreeComponent;
  }

  consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
    this._disposables.add(
      api.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return this._createView();
        }
      }),
      () => api.destroyWhere(item => item instanceof FileTreeSidebarComponent),
      atom.commands.add('atom-workspace', 'nuclide-file-tree:toggle', event => {
        api.toggle(WORKSPACE_VIEW_URI, (event: any).detail);
      }),
    );
    if (!this._restored) {
      api.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
    }
  }

  deserializeFileTreeSidebarComponent(): FileTreeSidebarComponent {
    return this._createView();
  }
}

createPackage(module.exports, Activation);
