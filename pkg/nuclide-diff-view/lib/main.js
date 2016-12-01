'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {NuclideUri} from '../../commons-node/nuclideUri';
import type {AppState, CommitModeType, DiffModeType, UIProvider} from './types';
import type {DiffEntityOptions} from './DiffViewModel';
import type FileTreeContextMenu from '../../nuclide-file-tree/lib/FileTreeContextMenu';
import type {HomeFragments} from '../../nuclide-home/lib/types';
import type {CwdApi} from '../../nuclide-current-working-directory/lib/CwdApi';
import type {GetToolBar} from '../../commons-atom/suda-tool-bar';
import type {OutputService, Message} from '../../nuclide-console/lib/types';
import type {Viewable, WorkspaceViewsService} from '../../nuclide-workspace-views/lib/types';

import type {RegisterNux, TriggerNux} from '../../nuclide-nux/lib/main';

import createPackage from '../../commons-atom/createPackage';
import {formatDiffViewUrl} from './utils';
import {React, ReactDOM} from 'react-for-atom';
import url from 'url';
import uiTreePath from '../../commons-atom/ui-tree-path';
import {repositoryForPath, getHgRepositoryStream} from '../../nuclide-hg-git-bridge';
import {
  CommitMode,
  DiffMode,
  DIFF_VIEW_NAVIGATOR_TOGGLE_COMMAND,
  SHOULD_DOCK_PUBLISH_VIEW_CONFIG_KEY,
} from './constants';
import DiffViewElement from './DiffViewElement';
import DiffViewComponent from './DiffViewComponent';
import DiffViewModel from './DiffViewModel';
import {track} from '../../nuclide-analytics';
import {createDiffViewNux, NUX_DIFF_VIEW_ID} from './diffViewNux';
import {observableFromSubscribeFunction} from '../../commons-node/event';
import SplitDiffView from './new-ui/SplitDiffView';
import DiffViewNavigatorGadget, {WORKSPACE_VIEW_URI} from './new-ui/DiffViewNavigatorGadget';
import DiffViewNavigatorComponent from './new-ui/DiffViewNavigatorComponent';
import passesGK from '../../commons-node/passesGK';
import {bindObservableAsProps} from '../../nuclide-ui/bindObservableAsProps';
import {viewableFromReactElement} from '../../commons-atom/viewableFromReactElement';

// Redux store
import type {Store} from './types';
import typeof * as BoundActionCreators from './redux/Actions';

import {createEmptyAppState} from './redux/createEmptyAppState';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import featureConfig from '../../commons-atom/featureConfig';
import {rootReducer} from './redux/Reducers';
import {applyMiddleware, bindActionCreators, createStore} from 'redux';
import {combineEpics, createEpicMiddleware} from '../../commons-node/redux-observable';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import UniversalDisposable from '../../commons-node/UniversalDisposable';
import {getLogger} from '../../nuclide-logging';

type SerializedDiffViewState = {
  visible: false,
} | {
  visible: true,
  activeFilePath: NuclideUri,
  viewMode: DiffModeType,
  commitMode: CommitModeType,
};

// This url style is the one Atom uses for the welcome and settings pages.
const NUCLIDE_DIFF_VIEW_URI = 'atom://nuclide/diff-view';
const DIFF_VIEW_FILE_TREE_CONTEXT_MENU_PRIORITY = 1000;
const COMMIT_FILE_TREE_CONTEXT_MENU_PRIORITY = 1100;
const AMEND_FILE_TREE_CONTEXT_MENU_PRIORITY = 1200;
const PUBLISH_FILE_TREE_CONTEXT_MENU_PRIORITY = 1300;

function dispatchDiffNavigatorToggle(visible: boolean): void {
  atom.commands.dispatch(
    atom.views.getView(atom.workspace),
    DIFF_VIEW_NAVIGATOR_TOGGLE_COMMAND,
    {visible},
  );
}

function diffActivePath(diffOptions?: Object): void {
  const editor = atom.workspace.getActiveTextEditor();
  if (editor == null) {
    atom.workspace.open(formatDiffViewUrl(diffOptions));
  } else {
    atom.workspace.open(formatDiffViewUrl({
      file: editor.getPath() || '',
      ...diffOptions,
    }));
  }
}

function isActiveEditorDiffable(): boolean {
  const editor = atom.workspace.getActiveTextEditor();
  if (editor == null) {
    return false;
  }
  return isPathDiffable(editor.getPath());
}

function shouldDisplayDiffTreeItem(contextMenu: FileTreeContextMenu): boolean {
  const node = contextMenu.getSingleSelectedNode();
  return node != null && isPathDiffable(node.uri);
}

function isPathDiffable(filePath: ?string): boolean {
  if (filePath == null || filePath.length === 0) {
    return false;
  }
  const repository = repositoryForPath(filePath);
  return repository != null && repository.getType() === 'hg';
}

// Listen for file tree context menu file item events to open the diff view.
function addFileTreeCommands(
  commandName: string,
  diffOptions?: Object,
): IDisposable {
  return new UniversalDisposable(
    atom.commands.add(
      '.tree-view .entry.file.list-item',
      commandName,
      event => {
        const filePath = uiTreePath(event);
        atom.workspace.open(formatDiffViewUrl({
          file: filePath || '',
          ...diffOptions,
        }));
      },
    ),
    atom.commands.add(
      '.tree-view .entry.directory.list-nested-item > .list-item',
      commandName,
      event => {
        const directoryPath = uiTreePath(event);
        atom.workspace.open(formatDiffViewUrl({
          directory: directoryPath || '',
          ...diffOptions,
        }));
      },
    ),
  );
}

function addActivePathCommands(
  commandName: string,
  diffOptions?: Object,
): IDisposable {
  function onTargetCommand(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    diffActivePath(diffOptions);
  }

  return new UniversalDisposable(
    atom.commands.add(
      'atom-workspace',
      commandName,
      onTargetCommand,
    ),
    // Listen for in-editor context menu item diff view open command.
    atom.commands.add(
      'atom-text-editor',
      commandName,
      onTargetCommand,
    ),
  );
}

class Activation {

  _subscriptions: UniversalDisposable;
  _diffViewModel: ?DiffViewModel;
  _diffViewElement: ?DiffViewElement;
  _diffViewComponent: ?React.Component<DiffViewComponent, any, any>;
  _tryTriggerNuxService: ?TriggerNux;
  _progressUpdates: Subject<Message>;
  _splitDiffView: ?SplitDiffView;
  _appState: BehaviorSubject<AppState>;

  _store: Store;
  _actionCreators: BoundActionCreators;

  constructor(rawState: ?SerializedDiffViewState) {
    this._subscriptions = new UniversalDisposable();
    this._progressUpdates = new Subject();

    const initialState = createEmptyAppState();

    const epics = Object.keys(Epics)
     .map(k => Epics[k])
     .filter(epic => typeof epic === 'function');
    const rootEpic = (actions, store) => (
      combineEpics(...epics)(actions, store)
        // Log errors and continue.
        .catch((error, stream) => {
          getLogger().error('Diff View Epics Error:', error);
          return stream;
        })
    );

    this._store = createStore(
      rootReducer,
      initialState,
      applyMiddleware(createEpicMiddleware(rootEpic)),
    );
    const states: Observable<AppState> = Observable.from(this._store).share();
    this._appState = new BehaviorSubject(initialState);
    this._actionCreators = bindActionCreators(Actions, this._store.dispatch);

    const configUpdates: Observable<boolean> =
      (featureConfig.observeAsStream(SHOULD_DOCK_PUBLISH_VIEW_CONFIG_KEY): any);

    this._subscriptions.add(
      // TODO(most): Remove Diff View model and use stream of props for the views instead.
      states.subscribe(_state => {
        const state: AppState = (_state: any);
        this._getDiffViewModel().injectState(state);
        this._appState.next(state);
      }),
      getHgRepositoryStream().subscribe(repository => {
        this._actionCreators.addRepository(repository);
      }),

      configUpdates.subscribe(shouldDockPublishView => {
        this._actionCreators.updateDockConfig(shouldDockPublishView);
      }),

      // Listen for menu item workspace diff view open command.
      addActivePathCommands('nuclide-diff-view:open'),
      addActivePathCommands('nuclide-diff-view:commit', {
        viewMode: DiffMode.COMMIT_MODE,
        commitMode: CommitMode.COMMIT,
      }),
      addActivePathCommands('nuclide-diff-view:amend', {
        viewMode: DiffMode.COMMIT_MODE,
        commitMode: CommitMode.AMEND,
      }),
      addActivePathCommands('nuclide-diff-view:publish', {
        viewMode: DiffMode.PUBLISH_MODE,
      }),

      // Context Menu Items.
      atom.contextMenu.add({
        'atom-text-editor': [
          {type: 'separator'},
          {
            label: 'Source Control',
            submenu: [
              {
                label: 'Open in Diff View',
                command: 'nuclide-diff-view:open',
              },
              {
                label: 'Commit',
                command: 'nuclide-diff-view:commit',
              },
              {
                label: 'Amend',
                command: 'nuclide-diff-view:amend',
              },
              {
                label: 'Publish to Phabricator',
                command: 'nuclide-diff-view:publish',
              },
            ],
            shouldDisplay() {
              return isActiveEditorDiffable();
            },
          },
          {type: 'separator'},
        ],
      }),

      // Listen for switching to editor mode for the active file.
      atom.commands.add(
        'nuclide-diff-view',
        'nuclide-diff-view:switch-to-editor',
        () => {
          const {filePath} = this._getDiffViewModel().getState().fileDiff;
          if (filePath != null && filePath.length) {
            atom.workspace.open(filePath);
          }
        },
      ),

      addFileTreeCommands('nuclide-diff-view:open-context'),
      addFileTreeCommands('nuclide-diff-view:commit-context', {
        viewMode: DiffMode.COMMIT_MODE,
        commitMode: CommitMode.COMMIT,
      }),
      addFileTreeCommands('nuclide-diff-view:amend-context', {
        viewMode: DiffMode.COMMIT_MODE,
        commitMode: CommitMode.AMEND,
      }),
      addFileTreeCommands('nuclide-diff-view:publish-context', {
        viewMode: DiffMode.PUBLISH_MODE,
      }),

      // The Diff View will open its main UI in a tab, like Atom's preferences and welcome pages.
      atom.workspace.addOpener(uri => {
        if (uri.startsWith(NUCLIDE_DIFF_VIEW_URI)) {
          const {query: diffEntityOptions} = url.parse(uri, true);
          return passesGK('nuclide_diff_view_new_ui').then(useNewUi => {
            if (useNewUi) {
              return this._openNewSplitView((diffEntityOptions: any));
            } else {
              return this._getDiffViewElement((diffEntityOptions: any));
            }
          });
        }
      }),
    );

    if (rawState == null || !rawState.visible) {
      return;
    }

    const {activeFilePath, viewMode, commitMode} = rawState;

    // Wait for the source control providers to be ready:
    const {serviceHub} = atom.packages;
    const restorationSubscription = Observable.merge(
      // If it's a local directory, or if "nuclide-hg-repository" was activated
      // after "nuclide-diff-view":
      observableFromSubscribeFunction(
        serviceHub.consume.bind(serviceHub, 'atom.repository-provider', '^0.1.0')),

      // If it's a remote directory, it should come on a path change event:
      observableFromSubscribeFunction(atom.project.onDidChangePaths.bind(atom.project)),
    ).debounceTime(50) // Delay to avoid rushing CPU at startup time.
    .subscribe(() => tryRestoreActiveDiffView());

    this._subscriptions.add(restorationSubscription);

    const tryRestoreActiveDiffView = () => {
      // If there is no repository ready, it may be because it's a remote file,
      // or because "nuclide-hg-repository" hasn't loaded yet.
      const canRestoreActiveDiffView = activeFilePath ?
        isPathDiffable(activeFilePath) :
        atom.project.getDirectories().some(directory => {
          return isPathDiffable(directory.getPath());
        });
      if (canRestoreActiveDiffView) {
        restorationSubscription.unsubscribe();
        this._subscriptions.remove(restorationSubscription);
        atom.workspace.open(formatDiffViewUrl({
          file: activeFilePath,
          viewMode,
          commitMode,
        }));
      }
    };
  }

  async _openNewSplitView(diffEntityOptions: DiffEntityOptions): Promise<?atom$TextEditor> {
    track('diff-view-open');
    track('diff-view-split-open');

    if (this._splitDiffView == null) {
      this._splitDiffView = new SplitDiffView(
        this._appState.asObservable(), this._actionCreators);
      this._subscriptions.add(this._splitDiffView);
    }

    this._actionCreators.updateDiffEditorsVisibility(true);
    if (!diffEntityOptions.onlyDiff) {
      // Show the Diff Navigator section.
      dispatchDiffNavigatorToggle(true);
    }

    this._activateDiffPath(diffEntityOptions);

    let textEditor;
    if (diffEntityOptions.file) {
      const filePath = diffEntityOptions.file;
      // Activate the text editor of the file to be diffed.
      textEditor = await atom.workspace.open(filePath, {searchAllPanes: true});
    } else {
      getLogger().warn('Split Diff View can only diff files');
    }

    return textEditor;
  }

  _getDiffViewModel(): DiffViewModel {
    let diffViewModel = this._diffViewModel;
    if (diffViewModel == null) {
      diffViewModel = new DiffViewModel(this._actionCreators, this._progressUpdates);
      this._diffViewModel = diffViewModel;
    }
    return diffViewModel;
  }

  // To add a View as an Atom workspace pane, we return `DiffViewElement` extending `HTMLElement`.
  // This pattern is also followed with atom's TextEditor.
  _getDiffViewElement(diffEntityOptions: DiffEntityOptions): DiffViewElement {
    if (this._diffViewElement != null) {
      const diffViewElement = this._diffViewElement;
      this._activateDiffPath(diffEntityOptions);
      return diffViewElement;
    }

    const diffModel = this._getDiffViewModel();
    this._actionCreators.updateDiffEditorsVisibility(true);
    this._actionCreators.updateDiffNavigatorVisibility(true);
    const hostElement = this._diffViewElement = new DiffViewElement()
      .initialize(diffModel, NUCLIDE_DIFF_VIEW_URI);
    this._diffViewComponent = ReactDOM.render(
      <DiffViewComponent
        actionCreators={this._actionCreators}
        diffModel={diffModel}
        tryTriggerNux={this.tryTriggerNux.bind(this, NUX_DIFF_VIEW_ID)}
      />,
      hostElement,
    );
    this._activateDiffPath(diffEntityOptions);

    const destroySubscription = hostElement.onDidDestroy(() => {
      ReactDOM.unmountComponentAtNode(hostElement);
      this._actionCreators.updateDiffEditorsVisibility(false);
      this._actionCreators.updateDiffNavigatorVisibility(false);
      this._actionCreators.updateDiffEditors(null);
      destroySubscription.dispose();
      this._subscriptions.remove(destroySubscription);
      this._diffViewElement = null;
      this._diffViewComponent = null;
    });

    this._subscriptions.add(
      () => { hostElement.destroy(); },
      destroySubscription,
    );

    track('diff-view-open');
    track('diff-view-old-open');
    return hostElement;
  }

  _activateDiffPath(diffEntityOptions: DiffEntityOptions): void {
    if (diffEntityOptions.file && this._diffViewModel != null) {
      this._diffViewModel.diffFile(diffEntityOptions.file);
    }
    const {viewMode, commit: {mode: commitMode}} = this._store.getState();
    if (diffEntityOptions.viewMode != null &&
        diffEntityOptions.viewMode !== viewMode) {
      this._actionCreators.setViewMode(diffEntityOptions.viewMode);
    }
    if (diffEntityOptions.commitMode != null &&
        diffEntityOptions.commitMode !== commitMode) {
      this._actionCreators.setCommitMode(diffEntityOptions.commitMode);
    }
  }

  consumeOutputService(api: OutputService): void {
    this._subscriptions.add(
      api.registerOutputProvider({
        id: 'diff-view',
        messages: this._progressUpdates.asObservable(),
      }),
    );
  }


  consumeToolBar(getToolBar: GetToolBar): IDisposable {
    const toolBar = getToolBar('nuclide-diff-view');
    toolBar.addSpacer({
      priority: 800,
    });
    const button = toolBar.addButton({
      icon: 'git-branch',
      callback: 'nuclide-diff-view:open',
      tooltip: 'Open Diff View',
      priority: 801,
    }).element;
    button.classList.add('diff-view-count');

    const diffModel = this._getDiffViewModel();
    let lastCount = null;
    const updateToolbarCount = () => {
      const count = diffModel.getDirtyFileChangesCount();
      if (count !== lastCount) {
        button.classList.toggle('positive-count', count > 0);
        button.classList.toggle('max-count', count > 99);
        button.dataset.count = count === 0 ? '' : (count > 99 ? '99+' : String(count));
        lastCount = count;
      }
    };
    updateToolbarCount();

    const toolBarSubscriptions = new UniversalDisposable(
      diffModel.onDidUpdateState(() => { updateToolbarCount(); }),
      () => { toolBar.removeItems(); },
    );
    this._subscriptions.add(toolBarSubscriptions);
    return toolBarSubscriptions;
  }

  getHomeFragments(): HomeFragments {
    return {
      feature: {
        title: 'Diff View',
        icon: 'git-branch',
        description: (
          <span>
            Launches an editable side-by-side compare view across mercurial dirty and commits
            changes, allowing committing and pushing changes to phabricator.
          </span>
        ),
        command: 'nuclide-diff-view:open',
      },
      priority: 3,
    };
  }

  serialize(): SerializedDiffViewState {
    const {
      commit: {mode: commitMode},
      diffEditorsVisible,
      fileDiff,
      viewMode,
    } = this._appState.getValue();
    if (!diffEditorsVisible) {
      return {
        visible: false,
      };
    }
    return {
      visible: true,
      activeFilePath: fileDiff.filePath,
      viewMode,
      commitMode,
    };
  }

  /**
   * The diff-view package can consume providers that return React components to
   * be rendered inline.
   * A uiProvider must have a method composeUiElements with the following spec:
   * @param filePath The path of the file the diff view is opened for
   * @param oldContents the contents of the compare-to text editor.
   * @param newContents the current filesystem status / edited contents.
   * @return An Observable of array of inline elements (defined above) to be rendered
   *         into the diff view
   */
  consumeUIProvider(provider: UIProvider): IDisposable {
    this._actionCreators.addUiProvider(provider);
    let pkg = this;
    this._subscriptions.add(() => { pkg = null; });
    return new UniversalDisposable(() => {
      if (pkg != null) {
        pkg._actionCreators.removeUiProvider(provider);
      }
    });
  }

  consumeCwdApi(api: CwdApi): IDisposable {
    this._actionCreators.setCwdApi(api);
    let pkg = this;
    this._subscriptions.add(() => { pkg = null; });
    return new UniversalDisposable(() => {
      if (pkg != null) {
        pkg._actionCreators.setCwdApi(null);
      }
    });
  }

  addItemsToFileTreeContextMenu(contextMenu: FileTreeContextMenu): IDisposable {
    const menuItemDescriptions = new UniversalDisposable(
      contextMenu.addItemToSourceControlMenu(
        {
          label: 'Open in Diff View',
          command: 'nuclide-diff-view:open-context',
          shouldDisplay() {
            return shouldDisplayDiffTreeItem(contextMenu);
          },
        },
        DIFF_VIEW_FILE_TREE_CONTEXT_MENU_PRIORITY,
      ),
      contextMenu.addItemToSourceControlMenu(
        {
          label: 'Commit',
          command: 'nuclide-diff-view:commit-context',
          shouldDisplay() {
            return shouldDisplayDiffTreeItem(contextMenu);
          },
        },
        COMMIT_FILE_TREE_CONTEXT_MENU_PRIORITY,
      ),
      contextMenu.addItemToSourceControlMenu(
        {
          label: 'Amend',
          command: 'nuclide-diff-view:amend-context',
          shouldDisplay() {
            return shouldDisplayDiffTreeItem(contextMenu);
          },
        },
        AMEND_FILE_TREE_CONTEXT_MENU_PRIORITY,
      ),
      contextMenu.addItemToSourceControlMenu(
        {
          label: 'Publish to Phabricator',
          command: 'nuclide-diff-view:publish-context',
          shouldDisplay() {
            return shouldDisplayDiffTreeItem(contextMenu);
          },
        },
        PUBLISH_FILE_TREE_CONTEXT_MENU_PRIORITY,
      ),
    );

    this._subscriptions.add(menuItemDescriptions);

    // We don't need to dispose of the menuItemDescriptions when the provider is disabled -
    // it needs to be handled by the provider itself. We only should remove it from the list
    // of the disposables we maintain.
    return new UniversalDisposable(() => {
      this._subscriptions.remove(menuItemDescriptions);
    });
  }

  __getDiffViewComponent() {
    return this._diffViewComponent;
  }

  tryTriggerNux(nuxID: number): void {
    if (this._tryTriggerNuxService != null) {
      this._tryTriggerNuxService(nuxID);
    }
  }

  consumeRegisterNuxService(addNewNux: RegisterNux): IDisposable {
    const disposable = addNewNux(createDiffViewNux());
    this._subscriptions.add(disposable);
    return disposable;
  }

  consumeTriggerNuxService(triggerNuxService: TriggerNux): void {
    this._tryTriggerNuxService = triggerNuxService;
  }

  consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
    this._subscriptions.add(
      api.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return this._createDiffViewNavigatorElement();
        }
      }),
      () => api.destroyWhere(item => item instanceof DiffViewNavigatorGadget),
      atom.commands.add(
        'atom-workspace',
        DIFF_VIEW_NAVIGATOR_TOGGLE_COMMAND,
        event => { api.toggle(WORKSPACE_VIEW_URI, (event: any).detail); },
      ),
    );
  }

  _createDiffViewNavigatorElement(): Viewable {
    track('diff-view-navigator-open');
    const diffModel = this._getDiffViewModel();
    const actionCreators = this._actionCreators;

    const boundComponent = bindObservableAsProps(
      this._appState.map(state => ({
        ...state,
        actionCreators,
        diffModel,
      })),
      DiffViewNavigatorComponent,
    );

    return viewableFromReactElement(
      <DiffViewNavigatorGadget
        actionCreators={actionCreators}
        component={boundComponent}
      />,
    );
  }

  deserializeDiffViewNavigator(): Viewable {
    return this._createDiffViewNavigatorElement();
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}

export default createPackage(Activation);
