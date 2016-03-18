'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {
  React,
  ReactDOM,
} from 'react-for-atom';
import FileTree from './FileTree';
import {FileTreeToolbarComponent} from './FileTreeToolbarComponent';
import FileTreeStore from '../lib/FileTreeStore';
import FileTreeSideBarFilterComponent from './FileTreeSideBarFilterComponent';
import {CompositeDisposable} from 'atom';

type State = {
  shouldRenderToolbar: boolean;
}

class FileTreeSidebarComponent extends React.Component {
  _store: FileTreeStore;
  _disposables: CompositeDisposable;
  state: State;

  constructor(props: Object) {
    super(props);

    this._store = FileTreeStore.getInstance();
    this.state = {
      shouldRenderToolbar: false,
    };
    this._disposables = new CompositeDisposable();
    (this: any)._handleFocus = this._handleFocus.bind(this);
  }

  componentDidMount(): void {
    this._processExternalUpdate();
    this._disposables.add(
      this._store.subscribe(this._processExternalUpdate.bind(this))
    );
    this._disposables.add(atom.project.onDidChangePaths(this._processExternalUpdate.bind(this)));
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  _handleFocus(event: SyntheticEvent): void {
    // Delegate focus to the FileTree component if this component gains focus because the FileTree
    // matches the selectors targeted by themes to show the containing panel has focus.
    if (event.target === ReactDOM.findDOMNode(this)) {
      ReactDOM.findDOMNode(this.refs['fileTree']).focus();
    }
  }

  render() {
    const workingSetsStore = this._store.getWorkingSetsStore();
    const filter = this._store.getFilter();
    const found = this._store.getFilterFound();
    let toolbar;
    if (this.state.shouldRenderToolbar && workingSetsStore != null) {
      toolbar = [
        <FileTreeSideBarFilterComponent key="filter" found={found} filter={filter} />,
        <FileTreeToolbarComponent key="toolbar" workingSetsStore={workingSetsStore} />
      ];
    }

    // Include `tabIndex` so this component can be focused by calling its native `focus` method.
    return (
      <div
        className="nuclide-file-tree-toolbar-container"
        onFocus={this._handleFocus}
        tabIndex={0}>
        {toolbar}
        <FileTree filter={filter}
                  nodeToKeepInView={this._store.getTrackedNode()}
                  ref="fileTree" />
      </div>
    );
  }

  _processExternalUpdate(): void {
    const shouldRenderToolbar = this._store.getRootKeys().length !== 0;

    if (shouldRenderToolbar !== this.state.shouldRenderToolbar) {
      this.setState({shouldRenderToolbar});
    } else {
      // Note: It's safe to call forceUpdate here because the change events are de-bounced.
      this.forceUpdate();
    }
  }
}

module.exports = FileTreeSidebarComponent;
