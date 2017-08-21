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

import type {FileChangeStatusValue} from '../../nuclide-vcs-base';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ShowUncommittedChangesKindValue} from '../lib/Constants';

import {Emitter} from 'atom';
import React from 'react';
import ReactDOM from 'react-dom';
import observePaneItemVisibility from 'nuclide-commons-atom/observePaneItemVisibility';
import addTooltip from 'nuclide-commons-ui/addTooltip';
import {Observable} from 'rxjs';
import {ShowUncommittedChangesKind} from '../lib/Constants';
import FileTreeHelpers from '../lib/FileTreeHelpers';

import {
  REVEAL_FILE_ON_SWITCH_SETTING,
  SHOW_OPEN_FILE_CONFIG_KEY,
  SHOW_UNCOMMITTED_CHANGES_CONFIG_KEY,
  SHOW_UNCOMMITTED_CHANGES_KIND_CONFIG_KEY,
  WORKSPACE_VIEW_URI,
} from '../lib/Constants';
import {
  filterMultiRootFileChanges,
  repositoryForPath,
} from '../../nuclide-vcs-base';
import {
  LoadingSpinner,
  LoadingSpinnerSizes,
} from 'nuclide-commons-ui/LoadingSpinner';
import {FileTree} from './FileTree';
import {Icon} from 'nuclide-commons-ui/Icon';
import FileTreeSideBarFilterComponent from './FileTreeSideBarFilterComponent';
import {FileTreeToolbarComponent} from './FileTreeToolbarComponent';
import {OpenFilesListComponent} from './OpenFilesListComponent';
import {LockableHeight} from './LockableHeightComponent';
import FileTreeActions from '../lib/FileTreeActions';
import {FileTreeStore} from '../lib/FileTreeStore';
import {MultiRootChangedFilesView} from '../../nuclide-ui/MultiRootChangedFilesView';
import {PanelComponentScroller} from 'nuclide-commons-ui/PanelComponentScroller';
import {
  nextAnimationFrame,
  toggle,
  throttle,
  compact,
} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {cacheWhileSubscribed} from 'nuclide-commons/observable';
import {Section} from '../../nuclide-ui/Section';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {track} from '../../nuclide-analytics';
import invariant from 'assert';
import {remote} from 'electron';
import {showMenuForEvent} from '../../commons-atom/context-menu';

type State = {
  shouldRenderToolbar: boolean,
  scrollerHeight: number,
  scrollerScrollTop: number,
  showOpenFiles: boolean,
  showUncommittedChanges: boolean,
  showUncommittedChangesKind: ShowUncommittedChangesKindValue,
  openFilesUris: Array<NuclideUri>,
  modifiedUris: Array<NuclideUri>,
  activeUri: ?NuclideUri,
  hidden: boolean,
  uncommittedFileChanges: Map<
    NuclideUri,
    Map<NuclideUri, FileChangeStatusValue>,
  >,
  isCalculatingChanges: boolean,
  areStackChangesEnabled: boolean,
  path: string,
  title: string,
  isFileTreeHovered: boolean,
};

export default class FileTreeSidebarComponent extends React.Component {
  _actions: FileTreeActions;
  _store: FileTreeStore;
  _emitter: Emitter;
  _disposables: UniversalDisposable;
  _showOpenConfigValues: Observable<boolean>;
  _showUncommittedConfigValue: Observable<boolean>;
  _showUncommittedKindConfigValue: Observable<ShowUncommittedChangesKindValue>;
  _scrollWasTriggeredProgrammatically: boolean;
  state: State;

  constructor() {
    super();

    this._actions = FileTreeActions.getInstance();
    this._store = FileTreeStore.getInstance();
    this._emitter = new Emitter();
    this.state = {
      hidden: false,
      shouldRenderToolbar: false,
      scrollerHeight: window.innerHeight,
      scrollerScrollTop: 0,
      showOpenFiles: true,
      showUncommittedChanges: true,
      showUncommittedChangesKind: 'Uncommitted changes',
      openFilesUris: [],
      modifiedUris: [],
      activeUri: null,
      uncommittedFileChanges: new Map(),
      isCalculatingChanges: false,
      areStackChangesEnabled: false,
      path: 'No Current Working Directory',
      title: 'File Tree',
      isFileTreeHovered: false,
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

    this._disposables = new UniversalDisposable(this._emitter);
    this._scrollWasTriggeredProgrammatically = false;
  }

  componentDidMount(): void {
    this._processExternalUpdate();

    const remeasureEvents = Observable.merge(
      Observable.of(null),
      Observable.fromEvent(window, 'resize'),
      observableFromSubscribeFunction(
        atom.commands.onDidDispatch.bind(atom.commands),
      ).filter(event => event.type === 'nuclide-file-tree:toggle'),
      Observable.interval(2000), // We poll because lots of things can change the height :(
    );

    this._disposables.add(
      this._store.subscribe(this._processExternalUpdate),
      atom.project.onDidChangePaths(this._processExternalUpdate),
      toggle(
        observeAllModifiedStatusChanges(),
        this._showOpenConfigValues,
      ).subscribe(() => this._setModifiedUris()),
      this._monitorActiveUri(),
      Observable.fromPromise(
        FileTreeHelpers.areStackChangesEnabled(),
      ).subscribe(areStackChangesEnabled =>
        this.setState({areStackChangesEnabled}),
      ),
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
      compact(
        throttle(remeasureEvents, () => nextAnimationFrame).map(() =>
          this._getScrollerHeight(),
        ),
      )
        .distinctUntilChanged()
        .subscribe(scrollerHeight => {
          this.setState({scrollerHeight});
        }),
      // Customize the context menu to remove items that match the 'atom-pane' selector.
      Observable.fromEvent(ReactDOM.findDOMNode(this), 'contextmenu')
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
      observePaneItemVisibility(this).subscribe(visible => {
        this.didChangeVisibility(visible);
      }),
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  componentDidUpdate(prevProps: mixed, prevState: State): void {
    if (prevState.hidden && !this.state.hidden) {
      // If "Reveal File on Switch" is enabled, ensure the scroll position is synced to where the
      // user expects when the side bar shows the file tree.
      if (featureConfig.get(REVEAL_FILE_ON_SWITCH_SETTING)) {
        atom.commands.dispatch(
          atom.views.getView(atom.workspace),
          'nuclide-file-tree:reveal-active-file',
        );
      }
      this._actions.clearFilter();
      const scrollerHeight = this._getScrollerHeight();
      if (scrollerHeight != null) {
        this.setState({scrollerHeight});
      }
    }

    const node = ReactDOM.findDOMNode(this.refs.scroller);
    if (node) {
      // $FlowFixMe
      node.scrollTop = this.state.scrollerScrollTop;
    }
  }

  _handleFocus = (event: SyntheticEvent): void => {
    if (event.target === ReactDOM.findDOMNode(this)) {
      this.focus();
    }
  };

  render() {
    const workingSetsStore = this._store.getWorkingSetsStore();
    let toolbar;
    if (this.state.shouldRenderToolbar && workingSetsStore != null) {
      toolbar = (
        <div className="nuclide-file-tree-fixed">
          <FileTreeSideBarFilterComponent
            key="filter"
            filter={this._store.getFilter()}
            found={this._store.getFilterFound()}
          />
          {this._store.foldersExpanded &&
            <FileTreeToolbarComponent
              key="toolbar"
              workingSetsStore={workingSetsStore}
            />}
        </div>
      );
    }

    let uncommittedChangesSection;
    let uncommittedChangesHeadline;
    if (this.state.showUncommittedChanges) {
      const uncommittedChangesList = (
        <div className="nuclide-file-tree-sidebar-uncommitted-changes">
          <MultiRootChangedFilesView
            analyticsSurface="file-tree-uncommitted-changes"
            commandPrefix="file-tree-sidebar"
            enableInlineActions={true}
            fileStatuses={filterMultiRootFileChanges(
              this.state.uncommittedFileChanges,
            )}
            selectedFile={this.state.activeUri}
            hideEmptyFolders={true}
            onFileChosen={this._onFileChosen}
            openInDiffViewOption={true}
          />
        </div>
      );

      if (!this.state.areStackChangesEnabled) {
        uncommittedChangesHeadline = 'UNCOMMITTED CHANGES';
      } else {
        const showDropdown = Array.from(
          this.state.uncommittedFileChanges.keys(),
        ).some(path => {
          const repo = repositoryForPath(path);
          return repo != null && repo.getType() === 'hg';
        });

        const dropdownIcon = !showDropdown
          ? null
          : <Icon
              icon="triangle-down"
              className="nuclide-file-tree-toolbar-fader nuclide-ui-dropdown-icon"
              onClick={this._handleUncommittedChangesKindDownArrow}
            />;

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

        const calculatingChangesSpinner = !this.state.isCalculatingChanges
          ? null
          : <span className="nuclide-file-tree-spinner">
              &nbsp;
              <LoadingSpinner
                className="inline-block"
                size={LoadingSpinnerSizes.EXTRA_SMALL}
              />
            </span>;

        uncommittedChangesHeadline = (
          <span ref={addTooltip({title: dropdownTooltip})}>
            <span className="nuclide-dropdown-label-text-wrapper">
              {this.state.showUncommittedChangesKind.toUpperCase()}
            </span>
            {dropdownIcon}
            {calculatingChangesSpinner}
          </span>
        );
      }

      uncommittedChangesSection = (
        <Section
          className="nuclide-file-tree-section-caption"
          collapsable={true}
          collapsed={!this._store.uncommittedChangesExpanded}
          headline={uncommittedChangesHeadline}
          onChange={this._handleUncommittedFilesExpandedChange}
          size="small">
          <PanelComponentScroller>
            {uncommittedChangesList}
          </PanelComponentScroller>
        </Section>
      );
    }

    let openFilesSection = null;
    let openFilesList = null;
    if (this.state.showOpenFiles && this.state.openFilesUris.length > 0) {
      if (this._store.openFilesExpanded) {
        openFilesList = (
          <OpenFilesListComponent
            uris={this.state.openFilesUris}
            modifiedUris={this.state.modifiedUris}
            activeUri={this.state.activeUri}
          />
        );
      }
      openFilesSection = (
        <LockableHeight isLocked={this.state.isFileTreeHovered}>
          <Section
            className="nuclide-file-tree-section-caption nuclide-file-tree-open-files-section"
            collapsable={true}
            collapsed={!this._store.openFilesExpanded}
            headline="OPEN FILES"
            onChange={this._handleOpenFilesExpandedChange}
            size="small">
            {openFilesList}
          </Section>
        </LockableHeight>
      );
    }

    let foldersCaption;
    if (uncommittedChangesSection != null || openFilesSection != null) {
      foldersCaption = (
        <Section
          className="nuclide-file-tree-section-caption"
          headline="FOLDERS"
          collapsable={true}
          collapsed={!this._store.foldersExpanded}
          onChange={this._handleFoldersExpandedChange}
          size="small"
        />
      );
    }

    // Include `tabIndex` so this component can be focused by calling its native `focus` method.
    return (
      <div
        className="nuclide-file-tree-toolbar-container"
        onFocus={this._handleFocus}
        tabIndex={0}>
        {uncommittedChangesSection}
        {openFilesSection}
        {foldersCaption}
        {toolbar}
        {this._store.foldersExpanded &&
          <PanelComponentScroller ref="scroller" onScroll={this._handleScroll}>
            <FileTree
              ref="fileTree"
              containerHeight={this.state.scrollerHeight}
              containerScrollTop={this.state.scrollerScrollTop}
              scrollToPosition={this._scrollToPosition}
              onMouseEnter={this._handleFileTreeHovered}
              onMouseLeave={this._handleFileTreeUnhovered}
            />
          </PanelComponentScroller>}
      </div>
    );
  }

  _handleFileTreeHovered = () => {
    this.setState({isFileTreeHovered: true});
  };

  _handleFileTreeUnhovered = () => {
    this.setState({isFileTreeHovered: false});
  };

  _processExternalUpdate = (): void => {
    const shouldRenderToolbar = !this._store.roots.isEmpty();
    const openFilesUris = this._store.getOpenFilesWorkingSet().getUris();

    if (
      shouldRenderToolbar !== this.state.shouldRenderToolbar ||
      openFilesUris !== this.state.openFilesUris
    ) {
      this.setState({shouldRenderToolbar, openFilesUris});
    } else {
      // Note: It's safe to call forceUpdate here because the change events are de-bounced.
      this.forceUpdate();
    }

    const uncommittedFileChanges = this._store.getFileChanges();
    const isCalculatingChanges = this._store.getIsCalculatingChanges();

    this.setState({
      uncommittedFileChanges,
      isCalculatingChanges,
    });

    const title = this.getTitle();
    const path = this.getPath();
    if (title !== this.state.title || path !== this.state.path) {
      this.setState({
        title,
        path,
      });
      this._emitter.emit('did-change-title', this.getTitle());
      this._emitter.emit('did-change-path', this.getPath());
    }
  };

  _onFileChosen(filePath: NuclideUri): void {
    track('filetree-uncommitted-file-changes-file-open');
    goToLocation(filePath);
  }

  _handleFoldersExpandedChange = (isCollapsed: boolean): void => {
    if (isCollapsed) {
      this.setState({isFileTreeHovered: false});
    }
    this._actions.setFoldersExpanded(!isCollapsed);
  };

  _handleOpenFilesExpandedChange = (isCollapsed: boolean): void => {
    this._actions.setOpenFilesExpanded(!isCollapsed);
  };

  _handleUncommittedFilesExpandedChange = (isCollapsed: boolean): void => {
    track('filetree-uncommitted-file-changes-toggle');
    this._actions.setUncommittedChangesExpanded(!isCollapsed);
  };

  _handleUncommittedChangesKindDownArrow = (
    event: SyntheticMouseEvent,
  ): void => {
    invariant(remote != null);
    const menu = new remote.Menu();
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
    const currentWindow = remote.getCurrentWindow();
    menu.popup(currentWindow, event.clientX, event.clientY);
    event.stopPropagation();
  };

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
      atom.workspace.onDidStopChangingActivePaneItem.bind(atom.workspace),
    );

    return new UniversalDisposable(
      toggle(activeEditors, this._showOpenConfigValues).subscribe(editor => {
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

  _getScrollerHeight = (): ?number => {
    const component = this.refs.scroller;
    if (component == null) {
      return null;
    }
    const el = ReactDOM.findDOMNode(component);
    if (el == null) {
      return null;
    }
    // $FlowFixMe
    return el.clientHeight;
  };

  _handleScroll = (): void => {
    if (!this._scrollWasTriggeredProgrammatically) {
      this._actions.clearTrackedNode();
    }
    this._scrollWasTriggeredProgrammatically = false;
    const node = ReactDOM.findDOMNode(this.refs.scroller);
    // $FlowFixMe
    const {scrollTop} = node;
    if (scrollTop !== this.state.scrollerScrollTop) {
      this.setState({scrollerScrollTop: scrollTop});
    }
  };

  _scrollToPosition = (
    top: number,
    height: number,
    approximate: boolean,
  ): void => {
    const node = ReactDOM.findDOMNode(this.refs.scroller);
    if (node == null) {
      return;
    }

    if (!approximate) {
      this._actions.clearTrackedNodeIfNotLoading();
    }
    const requestedBottom = top + height;
    const currentBottom =
      this.state.scrollerScrollTop + this.state.scrollerHeight;
    if (
      top > this.state.scrollerScrollTop &&
      requestedBottom <= currentBottom
    ) {
      return; // Already in the view
    }

    const newTop = Math.max(
      top + height / 2 - this.state.scrollerHeight / 2,
      0,
    );
    setImmediate(() => {
      try {
        // For the rather unlikely chance that the node is already gone from the DOM
        this._scrollWasTriggeredProgrammatically = true;
        // $FlowFixMe
        node.scrollTop = newTop;
        if (this.state.scrollerScrollTop !== newTop) {
          this.setState({scrollerScrollTop: newTop});
        }
      } catch (e) {}
    });
  };

  isFocused(): boolean {
    const el = ReactDOM.findDOMNode(this.refs.fileTree);
    if (el == null) {
      return false;
    }
    return el.contains(document.activeElement);
  }

  focus(): void {
    const el = ReactDOM.findDOMNode(this.refs.fileTree);
    if (el == null) {
      return;
    }
    // $FlowFixMe
    el.focus();
  }

  getTitle(): string {
    const cwdKey = this._store.getCwdKey();
    if (cwdKey == null) {
      return 'File Tree';
    }

    return nuclideUri.basename(cwdKey);
  }

  // This is unfortunate, but Atom uses getTitle() to get the text in the tab and getPath() to get
  // the text in the tool-tip.
  getPath(): string {
    const cwdKey = this._store.getCwdKey();
    if (cwdKey == null) {
      return 'No Current Working Directory';
    }

    const trimmed = nuclideUri.trimTrailingSeparator(cwdKey);
    const directory = nuclideUri.getPath(trimmed);
    const host = nuclideUri.getHostnameOpt(trimmed);
    if (host == null) {
      return `Current Working Directory: ${directory}`;
    }

    return `Current Working Directory: '${directory}' on '${host}'`;
  }

  getDefaultLocation(): atom$PaneLocation {
    return 'left';
  }

  getAllowedLocations(): Array<atom$PaneLocation> {
    return ['left', 'right'];
  }

  getPreferredWidth(): number {
    return 300;
  }

  getIconName(): string {
    return 'file-directory';
  }

  getURI(): string {
    return WORKSPACE_VIEW_URI;
  }

  didChangeVisibility(visible: boolean): void {
    this.setState({hidden: !visible});
  }

  serialize(): Object {
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
    return this._emitter.on('did-change-title', callback);
  }

  onDidChangePath(callback: (v: ?string) => mixed): IDisposable {
    return this._emitter.on('did-change-path', callback);
  }
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
