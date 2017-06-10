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

import type {FileTreeNode} from '../lib/FileTreeNode';

import FileTreeActions from '../lib/FileTreeActions';
import React from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import {nextAnimationFrame} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {filterName} from '../lib/FileTreeFilterHelper';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {StatusCodeNumber} from '../../nuclide-hg-rpc/lib/hg-constants';
import {FileTreeStore} from '../lib/FileTreeStore';
import FileTreeHgHelpers from '../lib/FileTreeHgHelpers';
import addTooltip from 'nuclide-commons-ui/addTooltip';
import PathWithFileIcon from '../../nuclide-ui/PathWithFileIcon';
import invariant from 'assert';
import os from 'os';
import {Observable} from 'rxjs';

const store = FileTreeStore.getInstance();
const getActions = FileTreeActions.getInstance;

type Props = {
  node: FileTreeNode,
};
type State = {
  isLoading: boolean,
};

type SelectionMode =
  | 'single-select'
  | 'multi-select'
  | 'range-select'
  | 'invalid-select';

const SUBSEQUENT_FETCH_SPINNER_DELAY = 500;
const INITIAL_FETCH_SPINNER_DELAY = 25;
const INDENT_LEVEL = 17;

export class FileTreeEntryComponent extends React.Component {
  state: State;
  props: Props;
  // Keep track of the # of dragenter/dragleave events in order to properly decide
  // when an entry is truly hovered/unhovered, since these fire many times over
  // the duration of one user interaction.
  dragEventCount: number;
  _loadingTimeout: ?number;
  _disposables: ?UniversalDisposable;
  _pathContainer: ?HTMLElement;

  constructor(props: Props) {
    super(props);
    this.dragEventCount = 0;
    (this: any)._onMouseDown = this._onMouseDown.bind(this);
    (this: any)._onClick = this._onClick.bind(this);
    (this: any)._onDoubleClick = this._onDoubleClick.bind(this);

    (this: any)._onDragEnter = this._onDragEnter.bind(this);
    (this: any)._onDragLeave = this._onDragLeave.bind(this);
    (this: any)._onDragStart = this._onDragStart.bind(this);
    (this: any)._onDragOver = this._onDragOver.bind(this);
    (this: any)._onDrop = this._onDrop.bind(this);

    (this: any)._checkboxOnChange = this._checkboxOnChange.bind(this);
    (this: any)._checkboxOnClick = this._checkboxOnClick.bind(this);
    (this: any)._checkboxOnMouseDown = this._checkboxOnMouseDown.bind(this);

    this.state = {
      isLoading: false,
    };
  }

  shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
    return (
      nextProps.node !== this.props.node ||
      nextState.isLoading !== this.state.isLoading
    );
  }

  componentWillReceiveProps(nextProps: Props): void {
    if (nextProps.node.isLoading !== this.props.node.isLoading) {
      if (this._loadingTimeout != null) {
        clearTimeout(this._loadingTimeout);
        this._loadingTimeout = null;
      }

      if (nextProps.node.isLoading) {
        const spinnerDelay = nextProps.node.wasFetched
          ? SUBSEQUENT_FETCH_SPINNER_DELAY
          : INITIAL_FETCH_SPINNER_DELAY;

        this._loadingTimeout = setTimeout(() => {
          this._loadingTimeout = null;
          this.setState({
            isLoading: Boolean(this.props.node.isLoading),
          });
        }, spinnerDelay);
      } else {
        this.setState({
          isLoading: false,
        });
      }
    }
  }

  componentDidMount(): void {
    const el = ReactDOM.findDOMNode(this);
    this._disposables = new UniversalDisposable(
      // Because this element can be inside of an Atom panel (which adds its own drag and drop
      // handlers) we need to sidestep React's event delegation.
      Observable.fromEvent(el, 'dragenter').subscribe(this._onDragEnter),
      Observable.fromEvent(el, 'dragleave').subscribe(this._onDragLeave),
      Observable.fromEvent(el, 'dragstart').subscribe(this._onDragStart),
      Observable.fromEvent(el, 'dragover').subscribe(this._onDragOver),
      Observable.fromEvent(el, 'drop').subscribe(this._onDrop),
    );
  }

  componentWillUnmount(): void {
    invariant(this._disposables != null);
    this._disposables.dispose();
    if (this._loadingTimeout != null) {
      clearTimeout(this._loadingTimeout);
    }
  }

  render(): React.Element<any> {
    const node = this.props.node;

    const outerClassName = classnames('entry', {
      'file list-item': !node.isContainer,
      'directory list-nested-item': node.isContainer,
      'current-working-directory': node.isCwd,
      collapsed: !node.isLoading && !node.isExpanded,
      expanded: !node.isLoading && node.isExpanded,
      'project-root': node.isRoot,
      selected: node.isSelected || node.isDragHovered,
      'nuclide-file-tree-softened': node.shouldBeSoftened,
    });
    const listItemClassName = classnames({
      'header list-item': node.isContainer,
      loading: this.state.isLoading,
    });

    let statusClass;
    if (!node.conf.isEditingWorkingSet) {
      const vcsStatusCode = node.vcsStatusCode;
      if (vcsStatusCode === StatusCodeNumber.MODIFIED) {
        statusClass = 'status-modified';
      } else if (vcsStatusCode === StatusCodeNumber.ADDED) {
        statusClass = 'status-added';
      } else if (node.isIgnored) {
        statusClass = 'status-ignored';
      } else {
        statusClass = '';
      }
    } else {
      switch (node.checkedStatus) {
        case 'checked':
          statusClass = 'status-added';
          break;
        case 'partial':
          statusClass = 'status-modified';
          break;
        default:
          statusClass = '';
          break;
      }
    }

    let tooltip;
    if (node.isContainer) {
      if (node.isCwd) {
        tooltip = addTooltip({title: 'Current Working Root'});
      }
    }

    return (
      <li
        className={`${outerClassName} ${statusClass}`}
        style={{paddingLeft: this.props.node.getDepth() * INDENT_LEVEL}}
        draggable={true}
        onMouseDown={this._onMouseDown}
        onClick={this._onClick}
        onDoubleClick={this._onDoubleClick}>
        <div className={listItemClassName} ref="arrowContainer">
          <PathWithFileIcon
            className={classnames('name', 'nuclide-file-tree-path', {
              'icon-nuclicon-file-directory': node.isContainer && !node.isCwd,
              'icon-nuclicon-file-directory-starred': node.isContainer &&
                node.isCwd,
            })}
            isFolder={node.isContainer}
            path={node.uri}
            ref={elem => {
              this._pathContainer = elem;
              tooltip && tooltip(elem);
            }}
            data-name={node.name}
            data-path={node.uri}>
            {this._renderCheckbox()}
            {filterName(node.name, node.highlightedText, node.isSelected)}
          </PathWithFileIcon>
          {this._renderConnectionTitle()}
        </div>
      </li>
    );
  }

  _renderCheckbox(): ?React.Element<any> {
    if (!this.props.node.conf.isEditingWorkingSet) {
      return;
    }

    return (
      <Checkbox
        checked={this.props.node.checkedStatus === 'checked'}
        indeterminate={this.props.node.checkedStatus === 'partial'}
        onChange={this._checkboxOnChange}
        onClick={this._checkboxOnClick}
        onMouseDown={this._checkboxOnMouseDown}
      />
    );
  }

  _renderConnectionTitle(): ?React.Element<any> {
    if (!this.props.node.isRoot) {
      return null;
    }
    const title = this.props.node.connectionTitle;
    if (title === '' || title === '(default)') {
      return null;
    }

    return (
      <span className="nuclide-file-tree-connection-title highlight">
        {title}
      </span>
    );
  }

  _isToggleNodeExpand(event: SyntheticMouseEvent) {
    if (!this._pathContainer) {
      return;
    }

    const node = this.props.node;
    return (
      node.isContainer &&
      // $FlowFixMe
      ReactDOM.findDOMNode(this.refs.arrowContainer).contains(event.target) &&
      event.clientX <
        // $FlowFixMe
        ReactDOM.findDOMNode(this._pathContainer).getBoundingClientRect().left
    );
  }

  _onMouseDown(event: SyntheticMouseEvent) {
    event.stopPropagation();
    if (this._isToggleNodeExpand(event)) {
      return;
    }

    const node = this.props.node;

    const selectionMode = getSelectionMode(event);
    if (selectionMode === 'multi-select' && !node.isSelected) {
      getActions().addSelectedNode(node.rootUri, node.uri);
    } else if (selectionMode === 'range-select') {
      getActions().rangeSelectToNode(node.rootUri, node.uri);
    } else if (selectionMode === 'single-select' && !node.isSelected) {
      getActions().setSelectedNode(node.rootUri, node.uri);
    }
  }

  _onClick(event: SyntheticMouseEvent) {
    event.stopPropagation();
    const node = this.props.node;

    const deep = event.altKey;
    if (this._isToggleNodeExpand(event)) {
      this._toggleNodeExpanded(deep);
      return;
    }

    const selectionMode = getSelectionMode(event);

    if (
      selectionMode === 'range-select' ||
      selectionMode === 'invalid-select'
    ) {
      return;
    }

    if (selectionMode === 'multi-select') {
      if (node.isFocused) {
        getActions().unselectNode(node.rootUri, node.uri);
        // If this node was just unselected, immediately return and skip
        // the statement below that sets this node to focused.
        return;
      }
    } else {
      if (node.isContainer) {
        if (node.isFocused || node.conf.usePreviewTabs) {
          this._toggleNodeExpanded(deep);
        }
      } else {
        if (node.conf.usePreviewTabs) {
          getActions().confirmNode(node.rootUri, node.uri);
        }
      }
      // Set selected node to clear any other selected nodes (i.e. in the case of
      // previously having multiple selections).
      getActions().setSelectedNode(node.rootUri, node.uri);
    }

    if (node.isSelected) {
      getActions().setFocusedNode(node.rootUri, node.uri);
    }
  }

  _onDoubleClick(event: SyntheticMouseEvent) {
    event.stopPropagation();

    if (this.props.node.isContainer) {
      return;
    }

    if (this.props.node.conf.usePreviewTabs) {
      getActions().keepPreviewTab();
    } else {
      getActions().confirmNode(this.props.node.rootUri, this.props.node.uri);
    }
  }

  _onDragEnter(event: DragEvent) {
    event.stopPropagation();
    const movableNodes = store
      .getSelectedNodes()
      .filter(node =>
        FileTreeHgHelpers.isValidRename(node, this.props.node.uri),
      );

    // Ignores hover over invalid targets.
    if (!this.props.node.isContainer || movableNodes.size === 0) {
      return;
    }
    if (this.dragEventCount <= 0) {
      this.dragEventCount = 0;
      getActions().setDragHoveredNode(
        this.props.node.rootUri,
        this.props.node.uri,
      );
    }
    this.dragEventCount++;
  }

  _onDragLeave(event: DragEvent) {
    event.stopPropagation();
    // Avoid calling an unhoverNode action if dragEventCount is already 0.
    if (this.dragEventCount === 0) {
      return;
    }
    this.dragEventCount--;
    if (this.dragEventCount <= 0) {
      this.dragEventCount = 0;
      getActions().unhoverNode(this.props.node.rootUri, this.props.node.uri);
    }
  }

  _onDragStart(event: DragEvent) {
    event.stopPropagation();
    if (this._pathContainer == null) {
      return;
    }

    // $FlowFixMe
    const target: HTMLElement = ReactDOM.findDOMNode(this._pathContainer);
    if (target == null) {
      return;
    }

    const fileIcon = target.cloneNode(false);
    fileIcon.style.cssText =
      'position: absolute; top: 0; left: 0; color: #fff; opacity: .8;';
    invariant(document.body != null);
    document.body.appendChild(fileIcon);

    const {dataTransfer} = event;
    if (dataTransfer != null) {
      dataTransfer.effectAllowed = 'move';
      dataTransfer.setDragImage(fileIcon, -8, -4);
      dataTransfer.setData('initialPath', this.props.node.uri);
    }
    nextAnimationFrame.subscribe(() => {
      invariant(document.body != null);
      document.body.removeChild(fileIcon);
    });
  }

  _onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  _onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    // Reset the dragEventCount for the currently dragged node upon dropping.
    this.dragEventCount = 0;
    getActions().moveToNode(this.props.node.rootUri, this.props.node.uri);
  }

  _toggleNodeExpanded(deep: boolean): void {
    if (this.props.node.isExpanded) {
      if (deep) {
        getActions().collapseNodeDeep(
          this.props.node.rootUri,
          this.props.node.uri,
        );
      } else {
        getActions().collapseNode(this.props.node.rootUri, this.props.node.uri);
      }
    } else {
      if (deep) {
        getActions().expandNodeDeep(
          this.props.node.rootUri,
          this.props.node.uri,
        );
      } else {
        getActions().expandNode(this.props.node.rootUri, this.props.node.uri);
      }
    }
  }

  _checkboxOnChange(isChecked: boolean): void {
    if (isChecked) {
      getActions().checkNode(this.props.node.rootUri, this.props.node.uri);
    } else {
      getActions().uncheckNode(this.props.node.rootUri, this.props.node.uri);
    }
  }

  _checkboxOnClick(event: SyntheticEvent): void {
    event.stopPropagation();
  }

  _checkboxOnMouseDown(event: SyntheticMouseEvent): void {
    // Chrome messes with scrolling if a focused input is being scrolled out of view
    // so we'll just prevent the checkbox from receiving the focus
    event.preventDefault();
  }
}

function getSelectionMode(event: SyntheticMouseEvent): SelectionMode {
  if (
    (os.platform() === 'darwin' && event.metaKey && event.button === 0) ||
    (os.platform() !== 'darwin' && event.ctrlKey && event.button === 0)
  ) {
    return 'multi-select';
  }
  if (os.platform() === 'darwin' && event.ctrlKey && event.button === 0) {
    return 'single-select';
  }
  if (event.shiftKey && event.button === 0) {
    return 'range-select';
  }
  if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return 'single-select';
  }
  return 'invalid-select';
}
