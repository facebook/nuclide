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
/* global HTMLElement */

import type {GeneratedFileType} from '../../nuclide-generated-files-rpc';
import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import type {RevisionInfo} from '../../nuclide-hg-rpc/lib/types'; //
import type {FileChangeStatusValue} from '../../nuclide-vcs-base';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ShowUncommittedChangesKindValue} from '../lib/Constants';
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/WorkingSetsStore.js';
import type {Store, AppState} from '../lib/types';

import {Emitter} from 'atom';
import observableFromReduxStore from 'nuclide-commons/observableFromReduxStore';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {DragResizeContainer} from 'nuclide-commons-ui/DragResizeContainer';
import addTooltip from 'nuclide-commons-ui/addTooltip';
import {Observable, Subject} from 'rxjs';
import {getHeadToForkBaseRevisions} from '../../nuclide-hg-repository-client/lib/utils';
import {ShowUncommittedChangesKind, PREFERRED_WIDTH} from '../lib/Constants';
import * as FileTreeHelpers from '../lib/FileTreeHelpers';
import * as Actions from '../lib/redux/Actions';
import {Provider} from 'react-redux';
import passesGK from 'nuclide-commons/passesGK';

import {
  SHOW_OPEN_FILE_CONFIG_KEY,
  SHOW_UNCOMMITTED_CHANGES_CONFIG_KEY,
  SHOW_UNCOMMITTED_CHANGES_KIND_CONFIG_KEY,
} from '../lib/Constants';
import {
  repositoryForPath,
  addPath,
  confirmAndDeletePath,
  forgetPath,
  confirmAndRevertPath,
} from '../../nuclide-vcs-base';
import {
  LoadingSpinner,
  LoadingSpinnerSizes,
} from 'nuclide-commons-ui/LoadingSpinner';
import VirtualizedFileTree from './VirtualizedFileTree';
import {Icon} from 'nuclide-commons-ui/Icon';
import FileTreeSideBarFilterComponent from './FileTreeSideBarFilterComponent';
import {FileTreeToolbarComponent} from './FileTreeToolbarComponent';
import {OpenFilesListComponent} from './OpenFilesListComponent';
import {LockableHeight} from './LockableHeightComponent';
import {MultiRootChangedFilesView} from '../../nuclide-ui/MultiRootChangedFilesView';
import {PanelComponentScroller} from 'nuclide-commons-ui/PanelComponentScroller';
import {ResizeObservable} from 'nuclide-commons-ui/observable-dom';
import {
  toggle,
  compact,
  nextAnimationFrame,
  throttle,
} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {cacheWhileSubscribed} from 'nuclide-commons/observable';
import {Section} from 'nuclide-commons-ui/Section';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {track} from 'nuclide-analytics';
import invariant from 'assert';
import {remote} from 'electron';
import type {Menu} from 'nuclide-commons/electron-remote';
import {showMenuForEvent} from 'nuclide-commons-atom/ContextMenu';
import Immutable from 'immutable';
import {createSelector} from 'reselect';
import * as Selectors from '../lib/redux/Selectors';

type State = {|
  shouldRenderToolbar: boolean,
  scrollerHeight: number,
  scrollerWidth: number,
  showOpenFiles: boolean,
  showUncommittedChanges: boolean,
  showUncommittedChangesKind: ShowUncommittedChangesKindValue,
  openFilesUris: Array<NuclideUri>,
  modifiedUris: Array<NuclideUri>,
  activeUri: ?NuclideUri,
  uncommittedFileChanges: Immutable.Map<
    NuclideUri,
    Immutable.Map<NuclideUri, FileChangeStatusValue>,
  >,
  generatedOpenChangedFiles: Immutable.Map<NuclideUri, GeneratedFileType>,
  isCalculatingChanges: boolean,
  isFileTreeHovered: boolean,
  workingSetsStore: ?WorkingSetsStore,
  filter: string,
  filterFound: boolean,
  foldersExpanded: boolean,
  uncommittedChangesExpanded: boolean,
  openFilesExpanded: boolean,
  cwdRevisions: ?Array<RevisionInfo>,
  activeRevisionTitle: ?string,
|};

type Props = {|
  store: Store,
|};

export default class FileTreeSidebarComponent extends React.Component<
  Props,
  State,
> {
  _emitter: Emitter;
  _disposables: UniversalDisposable;
  _showOpenConfigValues: Observable<boolean>;
  _showUncommittedConfigValue: Observable<boolean>;
  _showUncommittedKindConfigValue: Observable<ShowUncommittedChangesKindValue>;
  _scrollerElements: Subject<?HTMLElement>;
  // $FlowFixMe flow does not recognize VirtualizedFileTree as React component
  _scrollerRef: ?React.ElementRef<VirtualizedFileTree>;
  _menu: ?Menu;

  constructor(props: Props) {
    super(props);
    this._emitter = new Emitter();
    this._disposables = new UniversalDisposable();
    this.state = {
      shouldRenderToolbar: false,
      scrollerHeight: window.innerHeight,
      scrollerWidth: PREFERRED_WIDTH,
      showOpenFiles: true,
      showUncommittedChanges: true,
      showUncommittedChangesKind: 'Uncommitted changes',
      openFilesUris: [],
      modifiedUris: [],
      activeUri: null,
      uncommittedFileChanges: Immutable.Map(),
      generatedOpenChangedFiles: Immutable.Map(),
      isCalculatingChanges: false,
      isFileTreeHovered: false,
      workingSetsStore: Selectors.getWorkingSetsStore(
        this.props.store.getState(),
      ),
      filter: Selectors.getFilter(this.props.store.getState()),
      filterFound: Selectors.getFilterFound(this.props.store.getState()),
      foldersExpanded: Selectors.getFoldersExpanded(
        this.props.store.getState(),
      ),
      uncommittedChangesExpanded: Selectors.getUncommittedChangesExpanded(
        this.props.store.getState(),
      ),
      openFilesExpanded: Selectors.getOpenFilesExpanded(
        this.props.store.getState(),
      ),
      cwdRevisions: null,
      activeRevisionTitle: null,
    };
    this._showOpenConfigValues = cacheWhileSubscribed(
      (featureConfig.observeAsStream(SHOW_OPEN_FILE_CONFIG_KEY): Observable<
        any,
      >),
    );
    this._showUncommittedConfigValue = cacheWhileSubscribed(
      (featureConfig.observeAsStream(
        SHOW_UNCOMMITTED_CHANGES_CONFIG_KEY,
      ): Observable<any>),
    );
    this._showUncommittedKindConfigValue = FileTreeHelpers.observeUncommittedChangesKindConfigKey();
    const observeCwd = Observable.fromPromise(
      passesGK('nuclide_file_tree_revision_selector'),
    ).switchMap(fileTreeRevisionSelectionEnabled => {
      if (fileTreeRevisionSelectionEnabled) {
        return observableFromReduxStore(this.props.store)
          .switchMap((state: AppState) => {
            const cwdApi = Selectors.getCwdApi(state);
            if (cwdApi == null) {
              return Observable.empty();
            }
            return observableFromSubscribeFunction(
              cwdCb => new UniversalDisposable(cwdApi.observeCwd(cwdCb)),
            );
          })
          .distinctUntilChanged()
          .switchMap(directory => {
            if (directory == null) {
              return Observable.empty();
            }
            const repo = repositoryForPath(directory);
            if (repo == null || repo.getType() !== 'hg') {
              return Observable.empty();
            }
            return ((repo: any): HgRepositoryClient).observeRevisionChanges();
          })
          .map(revisionInfo =>
            getHeadToForkBaseRevisions(revisionInfo.revisions)
              .reverse()
              .slice(0, -1),
          );
      } else {
        return Observable.empty();
      }
    });

    this._disposables.add(
      observeCwd.subscribe(revisions =>
        this.setState({cwdRevisions: revisions}),
      ),
    );

    this._scrollerElements = new Subject();
    this._scrollerRef = null;
    this._disposables.add(this._emitter, this._subscribeToResizeEvents());
  }

  componentDidMount(): void {
    const componentDOMNode = ReactDOM.findDOMNode(this);
    invariant(componentDOMNode instanceof HTMLElement);

    this._processExternalUpdate();

    this._disposables.add(
      observableFromSubscribeFunction(
        cb => new UniversalDisposable(this.props.store.subscribe(cb)),
      )
        .let(throttle(() => nextAnimationFrame))
        .subscribe(() => {
          this._processExternalUpdate();
        }),
      observeAllModifiedStatusChanges()
        .let(toggle(this._showOpenConfigValues))
        .subscribe(() => this._setModifiedUris()),
      this._monitorActiveUri(),
      this._showOpenConfigValues.subscribe(showOpenFiles =>
        this.setState({showOpenFiles}),
      ),
      this._showUncommittedConfigValue.subscribe(showUncommittedChanges =>
        this.setState({showUncommittedChanges}),
      ),
      this._showUncommittedKindConfigValue.subscribe(
        showUncommittedChangesKind =>
          this.setState({showUncommittedChangesKind}),
      ),
      // Customize the context menu to remove items that match the 'atom-pane' selector.
      Observable.fromEvent(componentDOMNode, 'contextmenu')
        .switchMap(event => {
          if (event.button !== 2) {
            return Observable.never();
          }

          event.preventDefault();
          event.stopPropagation();

          // Find all the item sets that match the 'atom-pane' selector. We're going to remove these
          // by changing their selector.
          const paneItemSets = atom.contextMenu.itemSets.filter(
            itemSet => itemSet.selector === 'atom-pane',
          );
          // Override the selector while we get the template.
          paneItemSets.forEach(itemSet => {
            itemSet.selector = 'do-not-match-anything';
          });
          const menuTemplate = atom.contextMenu.templateForEvent(event);
          paneItemSets.forEach(itemSet => {
            itemSet.selector = 'atom-pane';
          });
          // Wrap the disposable in an observable. This way we don't have to manually track these
          // disposables, they'll be managed for us.
          return Observable.create(() => showMenuForEvent(event, menuTemplate));
        })
        .subscribe(),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
    if (this._menu != null) {
      this._menu.closePopup();
    }
  }

  isFocused(): boolean {
    if (this._scrollerRef == null) {
      return false;
    }

    const el = ReactDOM.findDOMNode(this._scrollerRef);
    if (el == null) {
      return false;
    }
    return el.contains(document.activeElement);
  }

  _subscribeToResizeEvents(): rxjs$Subscription {
    const scrollerRects = this._scrollerElements.switchMap(scroller => {
      if (scroller == null) {
        return Observable.empty();
      }

      return new ResizeObservable(scroller).map(arr => {
        if (arr.length === 0) {
          return null;
        }

        return arr[arr.length - 1].contentRect;
      });
    });

    return scrollerRects
      .let(compact)
      .subscribe(rect =>
        this.setState({scrollerHeight: rect.height, scrollerWidth: rect.width}),
      );
  }

  _setScrollerRef = (node: React$ElementRef<any>): void => {
    this._scrollerRef = node;
    if (node == null) {
      this._scrollerElements.next(null);
      return;
    }

    const scroller = ReactDOM.findDOMNode(node);
    if (scroller == null) {
      this._scrollerElements.next(null);
      return;
    }

    invariant(scroller instanceof HTMLElement);
    this._scrollerElements.next(scroller);
  };

  focus(): void {
    if (this._scrollerRef == null) {
      return;
    }
    const el = ReactDOM.findDOMNode(this._scrollerRef);
    if (el == null) {
      return;
    }
    invariant(el instanceof HTMLElement);
    el.focus();
  }

  _handleFocus = (event: SyntheticEvent<>): void => {
    if (event.target === ReactDOM.findDOMNode(this)) {
      this.focus();
    }
  };

  _renderToolbar(workingSetsStore: WorkingSetsStore): React.Node {
    return (
      <div className="nuclide-file-tree-fixed">
        <FileTreeSideBarFilterComponent
          key="filter"
          filter={this.state.filter}
          found={this.state.filterFound}
        />
        {this.state.foldersExpanded && (
          <FileTreeToolbarComponent
            key="toolbar"
            workingSetsStore={workingSetsStore}
            store={this.props.store}
          />
        )}
      </div>
    );
  }

  _renderUncommittedChangesSection(): React.Node {
    const uncommittedChangesList = (
      <div className="nuclide-file-tree-sidebar-uncommitted-changes">
        <MultiRootChangedFilesView
          analyticsSurface="file-tree-uncommitted-changes"
          commandPrefix="file-tree-sidebar"
          enableInlineActions={true}
          fileStatuses={this._getFilteredUncommittedFileChanges(this.state)}
          generatedTypes={
            ((this.state.generatedOpenChangedFiles: any): Map<
              NuclideUri,
              GeneratedFileType,
            >)
          }
          selectedFile={this.state.activeUri}
          hideEmptyFolders={true}
          onFileChosen={this._onFileChosen}
          onFileOpen={this._onFileChosen}
          openInDiffViewOption={true}
          onClickAdd={uri => {
            const repo = repositoryForPath(uri);
            addPath(repo, uri);
          }}
          onClickDelete={uri => {
            const repo = repositoryForPath(uri);
            confirmAndDeletePath(repo, uri);
          }}
          onClickForget={uri => {
            const repo = repositoryForPath(uri);
            forgetPath(repo, uri);
          }}
          onClickRevert={uri => {
            const repo = repositoryForPath(uri);
            confirmAndRevertPath(repo, uri);
          }}
        />
      </div>
    );

    const showDropdown = Array.from(
      this.state.uncommittedFileChanges.keys(),
    ).some(path => {
      const repo = repositoryForPath(path);
      return repo != null && repo.getType() === 'hg';
    });

    const dropdownIcon = !showDropdown ? null : (
      <Icon
        icon="triangle-down"
        className="nuclide-file-tree-toolbar-fader nuclide-ui-dropdown-icon"
        onClick={this._handleUncommittedChangesKindDownArrow}
      />
    );

    const dropdownTooltip = `<div style="text-align: left;">
This section shows the file changes you've made:<br />
<br />
<b>UNCOMMITTED</b><br />
Just the changes that you have yet to amend/commit.<br />
<br />
<b>HEAD</b><br />
Just the changes that you've already amended/committed.<br />
<br />
<b>STACK</b><br />
All the changes across your entire stacked diff.
</div>`;

    const calculatingChangesSpinner = !this.state
      .isCalculatingChanges ? null : (
      <span className="nuclide-file-tree-spinner">
        &nbsp;
        <LoadingSpinner
          className="inline-block"
          size={LoadingSpinnerSizes.EXTRA_SMALL}
        />
      </span>
    );

    const uncommittedChangesHeadline = (
      // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
      <span ref={addTooltip({title: dropdownTooltip})}>
        <span className="nuclide-dropdown-label-text-wrapper">
          {this.state.activeRevisionTitle ??
            this.state.showUncommittedChangesKind.toUpperCase()}
        </span>
        {dropdownIcon}
        {calculatingChangesSpinner}
      </span>
    );

    return (
      <div
        className="nuclide-file-tree-uncommitted-changes-container"
        data-show-uncommitted-changes-kind={
          this.state.showUncommittedChangesKind
        }>
        <Section
          className="nuclide-file-tree-section-caption"
          collapsable={true}
          collapsed={!this.state.uncommittedChangesExpanded}
          headline={uncommittedChangesHeadline}
          onChange={this._handleUncommittedFilesExpandedChange}
          size="small">
          <DragResizeContainer>
            <PanelComponentScroller className="nuclide-file-tree-sidebar-uncommitted-changes-container">
              {uncommittedChangesList}
            </PanelComponentScroller>
          </DragResizeContainer>
        </Section>
      </div>
    );
  }

  _renderOpenFilesSection() {
    const openFilesList = this.state.openFilesExpanded ? (
      <OpenFilesListComponent
        uris={this.state.openFilesUris}
        modifiedUris={this.state.modifiedUris}
        generatedTypes={this.state.generatedOpenChangedFiles}
        activeUri={this.state.activeUri}
        store={this.props.store}
      />
    ) : null;
    return (
      <LockableHeight isLocked={this.state.isFileTreeHovered}>
        <Section
          className="nuclide-file-tree-section-caption nuclide-file-tree-open-files-section"
          collapsable={true}
          collapsed={!this.state.openFilesExpanded}
          headline="OPEN FILES"
          onChange={this._handleOpenFilesExpandedChange}
          size="small">
          {openFilesList}
        </Section>
      </LockableHeight>
    );
  }

  _renderFoldersCaption(): React.Node {
    return (
      <Section
        className="nuclide-file-tree-section-caption"
        headline="FOLDERS"
        collapsable={true}
        collapsed={!this.state.foldersExpanded}
        onChange={this._handleFoldersExpandedChange}
        size="small"
      />
    );
  }

  render() {
    const workingSetsStore = this.state.workingSetsStore;
    const toolbar =
      this.state.shouldRenderToolbar && workingSetsStore != null
        ? this._renderToolbar(workingSetsStore)
        : null;
    const uncommittedChangesSection = this.state.showUncommittedChanges
      ? this._renderUncommittedChangesSection()
      : null;
    const openFilesSection =
      this.state.showOpenFiles && this.state.openFilesUris.length > 0
        ? this._renderOpenFilesSection()
        : null;
    const foldersCaption =
      uncommittedChangesSection != null || openFilesSection != null
        ? this._renderFoldersCaption()
        : null;

    // Include `tabIndex` so this component can be focused by calling its native `focus` method.
    return (
      /* $FlowFixMe(>=0.86.0) This
       * comment suppresses an error found when Flow v0.86 was
       * deployed. To see the error, delete this comment and
       * run Flow. */
      <Provider store={this.props.store}>
        <div
          className="nuclide-file-tree-toolbar-container"
          onFocus={this._handleFocus}
          tabIndex={0}>
          {uncommittedChangesSection}
          {openFilesSection}
          {foldersCaption}
          {toolbar}
          {this.state.foldersExpanded && (
            <VirtualizedFileTree
              ref={this._setScrollerRef}
              onMouseEnter={this._handleFileTreeHovered}
              onMouseLeave={this._handleFileTreeUnhovered}
              height={this.state.scrollerHeight}
              width={this.state.scrollerWidth}
            />
          )}
        </div>
      </Provider>
    );
  }

  _handleFileTreeHovered = () => {
    this.setState({isFileTreeHovered: true});
  };

  _handleFileTreeUnhovered = () => {
    this.setState({isFileTreeHovered: false});
  };

  _processExternalUpdate = (): void => {
    const shouldRenderToolbar = !Selectors.isEmpty(this.props.store.getState());
    const openFilesUris = Selectors.getOpenFilesWorkingSet(
      this.props.store.getState(),
    ).getAbsoluteUris();
    const uncommittedFileChanges = Selectors.getFileChanges(
      this.props.store.getState(),
    );
    const generatedOpenChangedFiles = Selectors.getGeneratedOpenChangedFiles(
      this.props.store.getState(),
    );
    const isCalculatingChanges = Selectors.getIsCalculatingChanges(
      this.props.store.getState(),
    );
    const workingSetsStore = Selectors.getWorkingSetsStore(
      this.props.store.getState(),
    );
    const filter = Selectors.getFilter(this.props.store.getState());
    const filterFound = Selectors.getFilterFound(this.props.store.getState());
    const foldersExpanded = Selectors.getFoldersExpanded(
      this.props.store.getState(),
    );
    const uncommittedChangesExpanded = Selectors.getUncommittedChangesExpanded(
      this.props.store.getState(),
    );
    const openFilesExpanded = Selectors.getOpenFilesExpanded(
      this.props.store.getState(),
    );

    this.setState({
      shouldRenderToolbar,
      openFilesUris,
      uncommittedFileChanges,
      generatedOpenChangedFiles,
      isCalculatingChanges,
      workingSetsStore,
      filter,
      filterFound,
      foldersExpanded,
      uncommittedChangesExpanded,
      openFilesExpanded,
    });
  };

  _onFileChosen(filePath: NuclideUri): void {
    track('filetree-uncommitted-file-changes-file-open');
    goToLocation(filePath);
  }

  _handleFoldersExpandedChange = (isCollapsed: boolean): void => {
    if (isCollapsed) {
      this.setState({isFileTreeHovered: false});
    }
    this.props.store.dispatch(Actions.setFoldersExpanded(!isCollapsed));
  };

  _handleOpenFilesExpandedChange = (isCollapsed: boolean): void => {
    this.props.store.dispatch(Actions.setOpenFilesExpanded(!isCollapsed));
  };

  _handleUncommittedFilesExpandedChange = (isCollapsed: boolean): void => {
    track('filetree-uncommitted-file-changes-toggle');
    this.props.store.dispatch(
      Actions.setUncommittedChangesExpanded(!isCollapsed),
    );
  };

  _handleUncommittedChangesKindDownArrow = (
    event: SyntheticMouseEvent<>,
  ): void => {
    invariant(remote != null);
    const menu = new remote.Menu();
    if (this.state.cwdRevisions != null) {
      this.state.cwdRevisions.forEach(revision => {
        const revisionMenuItem = new remote.MenuItem({
          type: 'checkbox',
          checked: revision.title === this.state.activeRevisionTitle,
          label: revision.title,
          click: () => {
            this._handleChangeWorkingRevision(revision);
          },
        });
        menu.append(revisionMenuItem);
      });

      const separatorItem = new remote.MenuItem({
        type: 'separator',
      });
      menu.append(separatorItem);
    }

    for (const enumKey in ShowUncommittedChangesKind) {
      const kind: ShowUncommittedChangesKindValue =
        ShowUncommittedChangesKind[enumKey];
      const menuItem = new remote.MenuItem({
        type: 'checkbox',
        checked: this.state.showUncommittedChangesKind === kind,
        label: kind,
        click: () => {
          this._handleShowUncommittedChangesKindChange(kind);
        },
      });
      menu.append(menuItem);
    }
    menu.popup({x: event.clientX, y: event.clientY, async: true});
    this._menu = menu;
    event.stopPropagation();
  };

  _handleChangeWorkingRevision(revision: RevisionInfo): void {
    this.props.store.dispatch(Actions.changeWorkingRevision(revision));
    this.setState({activeRevisionTitle: revision.title});
  }

  _handleShowUncommittedChangesKindChange(
    showUncommittedChangesKind: ShowUncommittedChangesKindValue,
  ): void {
    switch (showUncommittedChangesKind) {
      case ShowUncommittedChangesKind.UNCOMMITTED:
        track('filetree-changes-kind-uncommitted');
        break;
      case ShowUncommittedChangesKind.HEAD:
        track('filetree-changes-kind-head');
        break;
      case ShowUncommittedChangesKind.STACK:
        track('filetree-changes-kind-stack');
        break;
    }
    featureConfig.set(
      SHOW_UNCOMMITTED_CHANGES_KIND_CONFIG_KEY,
      showUncommittedChangesKind,
    );
  }

  _setModifiedUris(): void {
    const modifiedUris = getCurrentBuffers()
      .filter(buffer => buffer.isModified())
      .map(buffer => buffer.getPath() || '')
      .filter(path => path !== '');

    this.setState({modifiedUris});
  }

  _monitorActiveUri(): IDisposable {
    const activeEditors = observableFromSubscribeFunction(
      atom.workspace.observeActiveTextEditor.bind(atom.workspace),
    );

    return new UniversalDisposable(
      activeEditors
        .debounceTime(100)
        .let(toggle(this._showOpenConfigValues))
        .subscribe(editor => {
          if (
            editor == null ||
            typeof editor.getPath !== 'function' ||
            editor.getPath() == null
          ) {
            this.setState({activeUri: null});
            return;
          }

          this.setState({activeUri: editor.getPath()});
        }),
    );
  }

  // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
  _getFilteredUncommittedFileChanges = createSelector(
    [(state: State) => state.uncommittedFileChanges],
    filterMultiRootFileChanges,
  );
}

function observeAllModifiedStatusChanges(): Observable<void> {
  const paneItemChangeEvents = Observable.merge(
    observableFromSubscribeFunction(
      atom.workspace.onDidAddPaneItem.bind(atom.workspace),
    ),
    observableFromSubscribeFunction(
      atom.workspace.onDidDestroyPaneItem.bind(atom.workspace),
    ),
  ).startWith(undefined);

  return paneItemChangeEvents.map(getCurrentBuffers).switchMap(buffers =>
    Observable.merge(
      ...(buffers.map(buffer => {
        return observableFromSubscribeFunction(
          buffer.onDidChangeModified.bind(buffer),
        );
      }): Array<Observable<void>>),
    ),
  );
}

function getCurrentBuffers(): Array<atom$TextBuffer> {
  const buffers = [];
  const editors = atom.workspace.getTextEditors();
  editors.forEach(te => {
    const buffer = te.getBuffer();

    if (typeof buffer.getPath !== 'function' || buffer.getPath() == null) {
      return;
    }

    if (buffers.indexOf(buffer) < 0) {
      buffers.push(buffer);
    }
  });

  return buffers;
}

function filterMultiRootFileChanges(
  unfilteredFileChanges: Immutable.Map<
    NuclideUri,
    Immutable.Map<NuclideUri, FileChangeStatusValue>,
  >,
): Map<NuclideUri, Map<NuclideUri, FileChangeStatusValue>> {
  const filteredFileChanges = new Map();
  // Filtering the changes to make sure they only show up under the directory the
  // file exists under.
  for (const [root, fileChanges] of unfilteredFileChanges) {
    const filteredFiles = new Map(
      fileChanges.filter((_, filePath) => filePath.startsWith(root)),
    );
    if (filteredFiles.size !== 0) {
      filteredFileChanges.set(root, filteredFiles);
    }
  }

  return filteredFileChanges;
}
