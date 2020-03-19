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

import type {TerminalApi} from 'atom-ide-ui';
import type {ExportStoreData, Store} from './types';
import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';
import type {RemoteProjectsService} from '../../nuclide-remote-projects';
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {AdditionalLogFilesProvider} from '../../nuclide-logging/lib/rpc-types';
import type {RemoteTransferService} from '../../nuclide-remote-transfer/lib/main';

import invariant from 'assert';

import * as Actions from './redux/Actions';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import featureConfig from 'nuclide-commons-atom/feature-config';
import disablePackage, {
  DisabledReason,
} from '../../commons-atom/disablePackage';
import {
  compact,
  macrotask,
  nextAnimationFrame,
  fastDebounce,
} from 'nuclide-commons/observable';

import FileTreeContextMenu from './FileTreeContextMenu';
import * as Selectors from './redux/Selectors';
import {WorkingSet} from '../../nuclide-working-sets-common';
import {REVEAL_FILE_ON_SWITCH_SETTING, WORKSPACE_VIEW_URI} from './Constants';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import {Observable} from 'rxjs';
import passesGK from 'nuclide-commons/passesGK';
import registerCommands from './registerCommands';
import ProjectSelectionManager from './ProjectSelectionManager';
import createStore from './redux/createStore';
import ViewModel from './ViewModel';

type SerializedState = {
  tree: ExportStoreData,
  restored: ?boolean,
};

/**
 * Minimum interval (in ms) between onChangeActivePaneItem events before revealing the active pane
 * item in the file tree.
 */
const OPEN_FILES_UPDATE_DEBOUNCE_INTERVAL_MS = 150;

const TERMINAL_CONTEXT_MENU_PRIORITY = 100;

const DESERIALIZER_VERSION = atom.workspace.getLeftDock == null ? 1 : 2;

class Activation {
  _didActivateDisposable: IDisposable;
  _cwdApiSubscription: ?IDisposable;
  _viewModel: ?ViewModel;
  _restored: boolean; // Has the package state been restored from a previous session?
  _store: Store;
  _contextMenu: FileTreeContextMenu;
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
      disablePackage('tree-view', {reason: DisabledReason.REIMPLEMENTED}),
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
    );

    const initialState = state == null ? null : state.tree;
    this._store = createStore();
    if (initialState != null) {
      this._store.dispatch(Actions.loadData(initialState));
    }

    this._disposables.add(registerCommands(this._store));
    this._store.dispatch(Actions.updateRootDirectories());
    this._contextMenu = new FileTreeContextMenu(this._store);
    this._restored = state.restored === true;

    const excludeVcsIgnoredPathsSetting = 'core.excludeVcsIgnoredPaths';
    const hideVcsIgnoredPathsSetting = 'nuclide-file-tree.hideVcsIgnoredPaths';
    const hideIgnoredNamesSetting = 'nuclide-file-tree.hideIgnoredNames';
    const ignoredNamesSetting = 'core.ignoredNames';
    const prefixKeyNavSetting =
      'nuclide-file-tree.allowKeyboardPrefixNavigation';
    const allowPendingPaneItems = 'core.allowPendingPaneItems';
    const autoExpandSingleChild = 'nuclide-file-tree.autoExpandSingleChild';
    const focusEditorOnFileSelection =
      'nuclide-file-tree.focusEditorOnFileSelection';

    this._disposables.add(
      this._fixContextMenuHighlight(),
      featureConfig.observe(prefixKeyNavSetting, (usePrefixNav: any) => {
        // config is void during startup, signifying no config yet
        if (usePrefixNav == null) {
          return;
        }
        this._store.dispatch(Actions.setUsePrefixNav(usePrefixNav));
      }),
      featureConfig
        .observeAsStream(REVEAL_FILE_ON_SWITCH_SETTING)
        .switchMap((shouldReveal: any) => {
          return shouldReveal
            ? this._currentActiveFilePath()
            : Observable.empty();
        })
        .subscribe(filePath => {
          this._store.dispatch(
            Actions.revealFilePath(filePath, /* showIfHidden */ false),
          );
        }),
      atom.config.observe(
        ignoredNamesSetting,
        (ignoredNames: string | Array<string>) => {
          let normalizedIgnoredNames;
          if (ignoredNames === '') {
            normalizedIgnoredNames = [];
          } else if (typeof ignoredNames === 'string') {
            normalizedIgnoredNames = [ignoredNames];
          } else {
            normalizedIgnoredNames = ignoredNames;
          }
          this._store.dispatch(Actions.setIgnoredNames(normalizedIgnoredNames));
        },
      ),
      featureConfig.observe(
        hideIgnoredNamesSetting,
        (hideIgnoredNames: any) => {
          this._store.dispatch(Actions.setHideIgnoredNames(hideIgnoredNames));
        },
      ),
      featureConfig.observe(
        hideVcsIgnoredPathsSetting,
        (hideVcsIgnoredPaths: any) => {
          this._store.dispatch(
            Actions.setHideVcsIgnoredPaths(hideVcsIgnoredPaths),
          );
        },
      ),
      atom.config.observe(
        excludeVcsIgnoredPathsSetting,
        excludeVcsIgnoredPaths => {
          this._store.dispatch(
            Actions.setExcludeVcsIgnoredPaths(excludeVcsIgnoredPaths),
          );
        },
      ),
      atom.config.observe(allowPendingPaneItems, (usePreviewTabs: ?boolean) => {
        // config is void during startup, signifying no config yet
        if (usePreviewTabs == null) {
          return;
        }
        this._store.dispatch(Actions.setUsePreviewTabs(usePreviewTabs));
      }),
      featureConfig.observe(autoExpandSingleChild, (value: mixed) => {
        this._store.dispatch(Actions.setAutoExpandSingleChild(value === true));
      }),
      featureConfig.observe(focusEditorOnFileSelection, (value: boolean) => {
        this._store.dispatch(Actions.setFocusEditorOnFileSelection(value));
      }),
      atom.commands.add('atom-workspace', 'tree-view:toggle-focus', () => {
        const viewModel = this._viewModel;
        if (viewModel == null) {
          return;
        }
        if (viewModel.isFocused()) {
          // Focus the center.
          const center = atom.workspace.getCenter
            ? atom.workspace.getCenter()
            : atom.workspace;
          center.getActivePane().activate();
        } else {
          // Focus the file tree.
          viewModel.focus();
        }
      }),
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
      const sub = nextAnimationFrame
        .repeat(3)
        .last()
        .subscribe(() => {
          showForEvent.call(atom.contextMenu, event);
          disposables.remove(sub);
        });
      disposables.add(sub);
    };

    return disposables;
  }

  // Currently we only support one remoteTransferService at a time.
  consumeRemoteFileTransfer(remoteTransferService: RemoteTransferService) {
    this._store.dispatch(
      Actions.gotRemoteTransferService(remoteTransferService),
    );
    return new UniversalDisposable(() => {
      this._store.dispatch(Actions.gotRemoteTransferService(null));
    });
  }

  consumeTerminal(terminal: TerminalApi): IDisposable {
    const contextMenu = this._contextMenu;
    const terminalMenuSubscription = new UniversalDisposable(
      contextMenu.addItemToShowInSection(
        {
          label: 'New Terminal Here',
          callback() {
            const node = contextMenu.getSingleSelectedNode();
            invariant(node != null);
            const cwd = node.isContainer
              ? node.uri
              : nuclideUri.dirname(node.uri);
            terminal.open({cwd});
          },
          shouldDisplay(): boolean {
            const node = contextMenu.getSingleSelectedNode();
            return node != null && node.uri != null && node.uri.length > 0;
          },
        },
        TERMINAL_CONTEXT_MENU_PRIORITY,
      ),
    );
    this._disposables.add(terminalMenuSubscription);

    return terminalMenuSubscription;
  }

  consumeCwdApi(cwdApi: CwdApi): IDisposable {
    if (this._cwdApiSubscription != null) {
      this._cwdApiSubscription.dispose();
    }
    this._store.dispatch(Actions.setCwdApi(cwdApi));
    this._cwdApiSubscription = new UniversalDisposable(() =>
      this._store.dispatch(Actions.setCwdApi(null)),
    );
    return this._cwdApiSubscription;
  }

  consumeRemoteProjectsService(service: RemoteProjectsService): IDisposable {
    this._store.dispatch(Actions.setRemoteProjectsService(service));
    return new UniversalDisposable(() => {
      this._store.dispatch(Actions.setRemoteProjectsService(null));
    });
  }

  dispose() {
    this._disposables.dispose();
  }

  serialize(): ?SerializedState {
    return {
      tree: Selectors.serialize(this._store.getState()),
      restored: true,
      // Scrap our serialization when docks become available. Technically, we only need to scrap
      // the "restored" value, but this is simpler.
      // TODO(matthewwithanm): After docks have been in Atom stable for a while, we can just change
      //   this to "2"
      version: atom.workspace.getLeftDock == null ? 1 : 2,
    };
  }

  consumeWorkingSetsStore(workingSetsStore: WorkingSetsStore): ?IDisposable {
    this._store.dispatch(Actions.updateWorkingSetsStore(workingSetsStore));
    this._store.dispatch(
      Actions.updateWorkingSet(workingSetsStore.getCurrent()),
    );

    const currentSubscription = workingSetsStore.subscribeToCurrent(
      currentWorkingSet => {
        this._store.dispatch(Actions.updateWorkingSet(currentWorkingSet));
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
      observableFromSubscribeFunction(cb =>
        atom.workspace.observeTextEditors(cb),
      ).flatMap(textEditor => {
        return observableFromSubscribeFunction(
          textEditor.onDidChangePath.bind(textEditor),
        ).takeUntil(
          observableFromSubscribeFunction(
            textEditor.onDidDestroy.bind(textEditor),
          ),
        );
      }),
    ).let(fastDebounce(OPEN_FILES_UPDATE_DEBOUNCE_INTERVAL_MS));

    this._disposables.add(
      rebuildSignals.subscribe(() => {
        const openUris = atom.workspace
          .getTextEditors()
          .filter(te => te.getPath() != null && te.getPath() !== '')
          .map(te => (te.getPath(): any));
        const openFilesWorkingSet = new WorkingSet(openUris);
        this._store.dispatch(
          Actions.updateOpenFilesWorkingSet(openFilesWorkingSet),
        );
      }),
    );

    return new UniversalDisposable(() => {
      this._store.dispatch(Actions.updateWorkingSetsStore(null));
      this._store.dispatch(Actions.updateWorkingSet(new WorkingSet()));
      this._store.dispatch(Actions.updateOpenFilesWorkingSet(new WorkingSet()));
      this._disposables.remove(currentSubscription);
      currentSubscription.dispose();
    });
  }

  _currentActiveFilePath(): Observable<NuclideUri> {
    const rawPathStream = observableFromSubscribeFunction(
      atom.workspace.onDidStopChangingActivePaneItem.bind(atom.workspace),
    )
      .startWith(null)
      .map(() => {
        const activePaneItem = atom.workspace.getActivePaneItem();
        if (activePaneItem == null || activePaneItem.getPath == null) {
          return null;
        }

        return activePaneItem.getPath();
      });

    return compact(rawPathStream).distinctUntilChanged();
  }

  provideContextMenuForFileTree(): FileTreeContextMenu {
    return this._contextMenu;
  }

  provideProjectSelectionManagerForFileTree(): ProjectSelectionManager {
    return new ProjectSelectionManager(this._store);
  }

  provideFileTreeAdditionalLogFilesProvider(): AdditionalLogFilesProvider {
    return {
      id: 'nuclide-file-tree',
      getAdditionalLogFiles: expire => {
        const fileTreeState = Selectors.collectDebugState(
          this._store.getState(),
        );
        try {
          return Promise.resolve([
            {
              title: 'FileTreeState.json',
              data: JSON.stringify(fileTreeState, null, 2),
            },
          ]);
        } catch (e) {
          return Promise.resolve([
            {
              title: 'FileTreeState.txt',
              data: 'Failed to collect',
            },
          ]);
        }
      },
    };
  }

  // TODO: Figure out how to send active revision changes to the diff service
  //  See Jordan's interactive scrollbar for reference
  // getCompareIdChanges(): Observable<?RevisionInfo> {
  //   return Observable.fromPromise(
  //     passesGK('nuclide_file_tree_revision_selector'),
  //   ).switchMap(revisionSelectionEnabled => {
  //     if (!revisionSelectionEnabled) {
  //       return Observable.empty();
  //     } else {
  //       return observableFromSubscribeFunction(cb => this._store.subscribe(cb))
  //         .switchMap(() =>
  //           Observable.of(this._store.getState().currentWorkingRevision),
  //         )
  //         .distinctUntilChanged();
  //     }
  //   });
  // }

  _createView(): ViewModel {
    // Currently, we assume that only one will be created.
    this._viewModel = new ViewModel(this._store);
    return this._viewModel;
  }

  _registerCommandAndOpener(): UniversalDisposable {
    const disposable = new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return this._createView();
        }
      }),
      () => destroyItemWhere(item => item instanceof ViewModel),
      atom.commands.add('atom-workspace', 'tree-view:toggle', () => {
        atom.workspace.toggle(WORKSPACE_VIEW_URI);
      }),
    );
    passesGK('nuclide_open_connect_menu_on_clean_startup').then(
      openConnectMenu => {
        if (!this._restored) {
          if (!openConnectMenu) {
            // eslint-disable-next-line nuclide-internal/atom-apis
            atom.workspace.open(WORKSPACE_VIEW_URI, {searchAllPanes: true});
          } else {
            disposable.add(
              observableFromSubscribeFunction(
                atom.project.onDidChangePaths.bind(atom.project),
              )
                .startWith(null)
                .map(() => atom.project.getPaths().length)
                .pairwise()
                .take(1)
                .subscribe(([oldLength, newLength]) => {
                  if (oldLength === 0 && newLength === 1) {
                    // eslint-disable-next-line nuclide-internal/atom-apis
                    atom.workspace.open(WORKSPACE_VIEW_URI, {
                      searchAllPanes: true,
                    });
                  }
                }),
            );
          }
        }
      },
    );
    return disposable;
  }

  deserializeFileTreeSidebarComponent(): ViewModel {
    return this._viewModel || this._createView();
  }

  // Exported for testing
  __getStore(): Store {
    return this._store;
  }
}

createPackage(module.exports, Activation);
