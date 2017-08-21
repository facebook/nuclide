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
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import invariant from 'assert';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import featureConfig from 'nuclide-commons-atom/feature-config';
import disablePackage from '../../commons-atom/disablePackage';
import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';
import {observeTextEditors} from 'nuclide-commons-atom/text-editor';
import {
  compact,
  macrotask,
  nextAnimationFrame,
} from 'nuclide-commons/observable';

import FileTreeSidebarComponent from '../components/FileTreeSidebarComponent';
import FileTreeController from './FileTreeController';
import {WorkingSet} from '../../nuclide-working-sets-common';
import {REVEAL_FILE_ON_SWITCH_SETTING, WORKSPACE_VIEW_URI} from './Constants';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
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

  constructor(rawState: ?SerializedState) {
    let state = rawState || {};
    const serializedVersionMatches =
      // flowlint-next-line sketchy-null-mixed:off
      (state.version || 1) === DESERIALIZER_VERSION;
    if (!serializedVersionMatches) {
      state = {};
    }

    this._disposables = new UniversalDisposable(
      disablePackage('tree-view'),
      // This is a horrible hack to work around the fact that the tree view doesn't properly clean
      // up after its views when disabled as soon as it's activated. See atom/tree-view#1136
      observableFromSubscribeFunction(
        atom.workspace.observePaneItems.bind(atom.workspace),
      )
        // Wait for any post-addition work to be done by tree-view.
        // $FlowFixMe: Add `delayWhen` to RxJS defs
        .delayWhen(() => macrotask)
        .subscribe(item => {
          if (
            item != null &&
            typeof item.getURI === 'function' &&
            item.getURI() === 'atom://tree-view' &&
            atom.packages.isPackageDisabled('tree-view') &&
            atom.workspace.paneForItem(item) && // Make sure it's still in the workspace.
            typeof item.destroy === 'function'
          ) {
            item.destroy();
          }
        }),
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
    const autoExpandSingleChild = 'nuclide-file-tree.autoExpandSingleChild';

    this._disposables.add(
      this._fixContextMenuHighlight(),
      featureConfig.observe(prefixKeyNavSetting, (x: any) =>
        this._setPrefixKeyNavSetting(x),
      ),
      featureConfig
        .observeAsStream(REVEAL_FILE_ON_SWITCH_SETTING)
        .switchMap((shouldReveal: any) => {
          return shouldReveal
            ? this._currentActiveFilePath()
            : Observable.empty();
        })
        .subscribe(filePath =>
          this._fileTreeController.revealFilePath(
            filePath,
            /* showIfHidden */ false,
          ),
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
      featureConfig.observe(
        autoExpandSingleChild,
        this._setAutoExpandSingleChild.bind(this),
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
      this._registerCommandAndOpener(),
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

  _currentActiveFilePath(): Observable<NuclideUri> {
    const rawPathStream = observableFromSubscribeFunction(
      atom.workspace.onDidStopChangingActivePaneItem.bind(atom.workspace),
    ).map(() => {
      const editor = atom.workspace.getActiveTextEditor();
      return editor != null ? editor.getPath() : null;
    });

    return compact(rawPathStream).distinctUntilChanged();
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

  _setAutoExpandSingleChild(autoExpandSingleChild: mixed): void {
    this._fileTreeController.setAutoExpandSingleChild(
      autoExpandSingleChild === true,
    );
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

  _registerCommandAndOpener(): UniversalDisposable {
    const disposable = new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return this._createView();
        }
      }),
      () => destroyItemWhere(item => item instanceof FileTreeSidebarComponent),
      atom.commands.add('atom-workspace', 'nuclide-file-tree:toggle', () => {
        atom.workspace.toggle(WORKSPACE_VIEW_URI);
      }),
    );
    if (!this._restored) {
      // eslint-disable-next-line nuclide-internal/atom-apis
      atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
    }
    return disposable;
  }

  deserializeFileTreeSidebarComponent(): FileTreeSidebarComponent {
    return this._createView();
  }
}

createPackage(module.exports, Activation);
