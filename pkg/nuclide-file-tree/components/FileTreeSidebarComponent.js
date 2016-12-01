'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {FileChangeStatusValue} from '../../nuclide-hg-git-bridge/lib/constants';
import type {NuclideUri} from '../../commons-node/nuclideUri';

import {
  React,
  ReactDOM,
} from 'react-for-atom';
import {Observable} from 'rxjs';

import {FileTree} from './FileTree';
import FileTreeSideBarFilterComponent from './FileTreeSideBarFilterComponent';
import {FileTreeToolbarComponent} from './FileTreeToolbarComponent';
import {OpenFilesListComponent} from './OpenFilesListComponent';
import FileTreeActions from '../lib/FileTreeActions';
import {FileTreeStore} from '../lib/FileTreeStore';
import {MultiRootChangedFilesView} from '../../nuclide-ui/MultiRootChangedFilesView';
import {PanelComponentScroller} from '../../nuclide-ui/PanelComponentScroller';
import {toggle} from '../../commons-node/observable';
import UniversalDisposable from '../../commons-node/UniversalDisposable';
import {observableFromSubscribeFunction} from '../../commons-node/event';
import {cacheWhileSubscribed} from '../../commons-node/observable';
import {Section} from '../../nuclide-ui/Section';
import featureConfig from '../../commons-atom/featureConfig';
import {track} from '../../nuclide-analytics';

type State = {
  shouldRenderToolbar: boolean,
  scrollerHeight: number,
  scrollerScrollTop: number,
  showOpenFiles: boolean,
  showUncommittedChanges: boolean,
  openFilesUris: Array<NuclideUri>,
  modifiedUris: Array<NuclideUri>,
  activeUri: ?NuclideUri,
  hasUncommittedChanges: boolean,
  uncommittedFileChanges: Map<NuclideUri, Map<NuclideUri, FileChangeStatusValue>>,
};

type Props = {
  hidden: boolean,
};

const SHOW_OPEN_FILE_CONFIG_KEY = 'nuclide-file-tree.showOpenFiles';
const SHOW_UNCOMMITTED_CHANGES_CONFIG_KEY = 'nuclide-file-tree.showUncommittedChanges';

class FileTreeSidebarComponent extends React.Component {
  _actions: FileTreeActions;
  _store: FileTreeStore;
  _disposables: UniversalDisposable;
  _afRequestId: ?number;
  _showOpenConfigValues: Observable<boolean>;
  _showUncommittedConfigValue: Observable<boolean>;
  _scrollWasTriggeredProgrammatically: boolean;
  state: State;
  props: Props;

  constructor(props: Props) {
    super(props);

    this._actions = FileTreeActions.getInstance();
    this._store = FileTreeStore.getInstance();
    this.state = {
      shouldRenderToolbar: false,
      scrollerHeight: 0,
      scrollerScrollTop: 0,
      showOpenFiles: true,
      showUncommittedChanges: true,
      openFilesUris: [],
      modifiedUris: [],
      activeUri: null,
      hasUncommittedChanges: false,
      uncommittedFileChanges: new Map(),
    };
    this._showOpenConfigValues = cacheWhileSubscribed(
      (featureConfig.observeAsStream(SHOW_OPEN_FILE_CONFIG_KEY): Observable<any>),
    );
    this._showUncommittedConfigValue = cacheWhileSubscribed(
      (featureConfig.observeAsStream(SHOW_UNCOMMITTED_CHANGES_CONFIG_KEY): Observable<any>),
    );

    this._disposables = new UniversalDisposable();
    this._afRequestId = null;
    this._scrollWasTriggeredProgrammatically = false;
    (this: any)._handleFocus = this._handleFocus.bind(this);
    (this: any)._onViewChange = this._onViewChange.bind(this);
    (this: any)._onScroll = this._onScroll.bind(this);
    (this: any)._scrollToPosition = this._scrollToPosition.bind(this);
    (this: any)._processExternalUpdate = this._processExternalUpdate.bind(this);
    (this: any)._handleOpenFilesExpandedChange = this._handleOpenFilesExpandedChange.bind(this);
    (this: any)._handleUncommittedFilesExpandedChange =
      this._handleUncommittedFilesExpandedChange.bind(this);
  }

  componentDidMount(): void {
    this._processExternalUpdate();

    window.addEventListener('resize', this._onViewChange);
    this._afRequestId = window.requestAnimationFrame(() => {
      this._onViewChange();
      this._afRequestId = null;
    });

    this._disposables.add(
      this._store.subscribe(this._processExternalUpdate),
      atom.project.onDidChangePaths(this._processExternalUpdate),
      toggle(observeAllModifiedStatusChanges(), this._showOpenConfigValues)
        .subscribe(() => this._setModifiedUris()),
      this._monitorActiveUri(),
      this._showOpenConfigValues.subscribe(showOpenFiles => this.setState({showOpenFiles})),
      this._showUncommittedConfigValue.subscribe(
        showUncommittedChanges => this.setState({showUncommittedChanges}),
      ),
      () => {
        window.removeEventListener('resize', this._onViewChange);
        if (this._afRequestId != null) {
          window.cancelAnimationFrame(this._afRequestId);
        }
      },
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.hidden && !this.props.hidden) {
      this._actions.clearFilter();
      this._onViewChange();
    }
  }

  _handleFocus(event: SyntheticEvent): void {
    // Delegate focus to the FileTree component if this component gains focus because the FileTree
    // matches the selectors targeted by themes to show the containing panel has focus.
    if (event.target === ReactDOM.findDOMNode(this)) {
      ReactDOM.findDOMNode(this.refs.fileTree).focus();
    }
  }

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
          <FileTreeToolbarComponent
            key="toolbar"
            workingSetsStore={workingSetsStore}
          />
        </div>
      );
    }

    let uncommittedChangesSection;
    if (this.state.showUncommittedChanges && this.state.hasUncommittedChanges) {
      const uncommittedChangesList = (
        <div className="nuclide-file-tree-sidebar-uncommitted-changes">
          <MultiRootChangedFilesView
            commandPrefix="file-tree-sidebar"
            fileChanges={this.state.uncommittedFileChanges}
            selectedFile={this.state.activeUri}
            hideEmptyFolders={true}
            onFileChosen={this._onFileChosen}
          />
        </div>
      );

      uncommittedChangesSection =
        <Section
          className="nuclide-file-tree-section-caption"
          collapsable={true}
          collapsed={!this._store.uncommittedChangesExpanded}
          headline="UNCOMMITTED CHANGES"
          onChange={this._handleUncommittedFilesExpandedChange}
          size="small">
          {uncommittedChangesList}
        </Section>;
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
      openFilesSection =
        <Section
          className="nuclide-file-tree-section-caption"
          collapsable={true}
          collapsed={!this._store.openFilesExpanded}
          headline="OPEN FILES"
          onChange={this._handleOpenFilesExpandedChange}
          size="small">
          {openFilesList}
        </Section>;
    }

    let foldersCaption;
    if (uncommittedChangesSection != null || openFilesSection != null) {
      foldersCaption =
        <Section className="nuclide-file-tree-section-caption" headline="FOLDERS" size="small" />;
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
        <PanelComponentScroller
          ref="scroller"
          onScroll={this._onScroll}>
          <FileTree
            ref="fileTree"
            containerHeight={this.state.scrollerHeight}
            containerScrollTop={this.state.scrollerScrollTop}
            scrollToPosition={this._scrollToPosition}
          />
        </PanelComponentScroller>
      </div>
    );
  }

  _processExternalUpdate(): void {
    const shouldRenderToolbar = !this._store.roots.isEmpty();
    const openFilesUris = this._store.getOpenFilesWorkingSet().getUris();

    if (shouldRenderToolbar !== this.state.shouldRenderToolbar ||
      openFilesUris !== this.state.openFilesUris
    ) {
      this.setState({shouldRenderToolbar, openFilesUris});
    } else {
      // Note: It's safe to call forceUpdate here because the change events are de-bounced.
      this.forceUpdate();
    }

    // Since we maintain the list of active directories for sidebar, the only way
    // to know if the section is empty or not is by checking each directory entry
    // and checking if they are empty. If all are empty hide the section.
    const uncommittedFileChanges = this._store.getFileChanges();
    const hasUncommittedChanges = Array.from(uncommittedFileChanges.values())
      .some(fileChanges => fileChanges.size > 0);

    this.setState({uncommittedFileChanges, hasUncommittedChanges});
  }

  _onFileChosen(filePath: NuclideUri): void {
    track('filetree-uncommitted-file-changes-file-open');
    atom.workspace.open(filePath);
  }

  _handleOpenFilesExpandedChange(isCollapsed: boolean): void {
    this._actions.setOpenFilesExpanded(!isCollapsed);
  }

  _handleUncommittedFilesExpandedChange(isCollapsed: boolean): void {
    track('filetree-uncommitted-file-changes-toggle');
    this._actions.setUncommittedChangesExpanded(!isCollapsed);
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
      toggle(activeEditors, this._showOpenConfigValues)
      .subscribe(editor => {
        if (editor == null || typeof editor.getPath !== 'function' || editor.getPath() == null) {
          this.setState({activeUri: null});
          return;
        }

        this.setState({activeUri: editor.getPath()});
      }),
    );
  }

  _onViewChange(): void {
    const node = ReactDOM.findDOMNode(this.refs.scroller);
    const {clientHeight, scrollTop} = node;

    if (clientHeight !== this.state.scrollerHeight || scrollTop !== this.state.scrollerScrollTop) {
      this.setState({scrollerHeight: clientHeight, scrollerScrollTop: scrollTop});
    }
  }

  _onScroll(): void {
    if (!this._scrollWasTriggeredProgrammatically) {
      this._actions.clearTrackedNode();
    }
    this._scrollWasTriggeredProgrammatically = false;
    this._onViewChange();
  }

  _scrollToPosition(top: number, height: number): void {
    const requestedBottom = top + height;
    const currentBottom = this.state.scrollerScrollTop + this.state.scrollerHeight;
    if (top > this.state.scrollerScrollTop && requestedBottom <= currentBottom) {
      return;  // Already in the view
    }

    const node = ReactDOM.findDOMNode(this.refs.scroller);
    if (node == null) {
      return;
    }
    const newTop = Math.max(top + height / 2 - this.state.scrollerHeight / 2, 0);
    setImmediate(() => {
      try {  // For the rather unlikely chance that the node is already gone from the DOM
        this._scrollWasTriggeredProgrammatically = true;
        node.scrollTop = newTop;
        this.setState({scrollerScrollTop: newTop});
      } catch (e) {}
    });
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
  )
  .startWith(undefined);

  return paneItemChangeEvents
  .map(getCurrentBuffers)
  .switchMap(buffers => Observable.merge(
    ...(buffers.map(buffer => {
      return observableFromSubscribeFunction(buffer.onDidChangeModified.bind(buffer));
    }): Array<Observable<void>>),
  ));
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

module.exports = FileTreeSidebarComponent;
