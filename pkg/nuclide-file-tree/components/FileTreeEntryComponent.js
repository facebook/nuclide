'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {FileTreeNode} from '../lib/FileTreeNode';

import FileTreeActions from '../lib/FileTreeActions';
import {React, ReactDOM} from 'react-for-atom';
import classnames from 'classnames';
import fileTypeClass from '../../commons-atom/file-type-class';
import {filterName} from '../lib/FileTreeFilterHelper';
import {Checkbox} from '../../nuclide-ui/lib/Checkbox';
import {StatusCodeNumber} from '../../nuclide-hg-repository-base/lib/hg-constants';
import {FileTreeStore} from '../lib/FileTreeStore';
import {isValidRename} from '../lib/FileTreeHgHelpers';

const store = FileTreeStore.getInstance();
const getActions = FileTreeActions.getInstance;

type Props = {
  node: FileTreeNode;
};

const INDENT_LEVEL = 17;

export class FileTreeEntryComponent extends React.Component {
  props: Props;
  // Keep track of the # of dragenter/dragleave events in order to properly decide
  // when an entry is truly hovered/unhovered, since these fire many times over
  // the duration of one user interaction.
  dragEventCount: number;

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
  }

  shouldComponentUpdate(nextProps: Object, nextState: void): boolean {
    return nextProps.node !== this.props.node;
  }

  render(): React.Element<any> {
    const node = this.props.node;

    const outerClassName = classnames('entry', {
      'file list-item': !node.isContainer,
      'directory list-nested-item': node.isContainer,
      'current-working-directory': node.isCwd,
      'collapsed': !node.isLoading && !node.isExpanded,
      'expanded': !node.isLoading && node.isExpanded,
      'project-root': node.isRoot,
      'selected': node.isSelected || node.isDragHovered,
      'nuclide-file-tree-softened': node.shouldBeSoftened,
    });
    const listItemClassName = classnames({
      'header list-item': node.isContainer,
      'loading': node.isLoading,
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

    let iconName;
    if (node.isContainer) {
      iconName = node.isCwd ? 'icon-briefcase' : 'icon-file-directory';
    } else {
      iconName = fileTypeClass(node.name);
    }

    return (
      <li
        className={`${outerClassName} ${statusClass}`}
        style={{paddingLeft: this.props.node.getDepth() * INDENT_LEVEL}}
        draggable={true}
        onMouseDown={this._onMouseDown}
        onClick={this._onClick}
        onDoubleClick={this._onDoubleClick}
        onDragEnter={this._onDragEnter}
        onDragLeave={this._onDragLeave}
        onDragStart={this._onDragStart}
        onDragOver={this._onDragOver}
        onDrop={this._onDrop}>
        <div
          className={listItemClassName}
          ref="arrowContainer">
          <span
            className={`icon name ${iconName}`}
            ref="pathContainer"
            data-name={node.name}
            data-path={node.uri}>
            {this._renderCheckbox()}
            <span
              data-name={node.name}
              data-path={node.uri}>
              {filterName(node.name, node.highlightedText, node.isSelected)}
            </span>
          </span>
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
      />
    );
  }

  _renderConnectionTitle(): ?React.Element<any> {
    if (!this.props.node.isRoot) {
      return null;
    }
    const title = this.props.node.connectionTitle;
    if (title === '') {
      return null;
    }

    return (
      <span className="nuclide-file-tree-connection-title highlight">
        {title}
      </span>
    );
  }

  _onMouseDown(event: SyntheticMouseEvent) {
    event.stopPropagation();
    const node = this.props.node;

    const modifySelection = event.ctrlKey || event.metaKey;
    if (modifySelection && !node.isSelected) {
      getActions().addSelectedNode(node.rootUri, node.uri);
    } else if (!node.isSelected) {
      getActions().setSelectedNode(node.rootUri, node.uri);
    }
  }

  _onClick(event: SyntheticMouseEvent) {
    event.stopPropagation();
    const node = this.props.node;

    const deep = event.altKey;
    if (
      node.isContainer &&
      ReactDOM.findDOMNode(this.refs.arrowContainer).contains(event.target) &&
      event.clientX < ReactDOM.findDOMNode(
        this.refs.pathContainer
      ).getBoundingClientRect().left
    ) {
      this._toggleNodeExpanded(deep);
      return;
    }

    const modifySelection = event.ctrlKey || event.metaKey;
    if (modifySelection) {
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

  _onDragEnter(event: SyntheticDragEvent) {
    event.stopPropagation();
    const movableNodes = store.getSelectedNodes()
      .filter(node => isValidRename(node, this.props.node.uri));

    // Ignores hover over invalid targets.
    if (!this.props.node.isContainer || movableNodes.size === 0) {
      return;
    }
    if (this.dragEventCount <= 0) {
      this.dragEventCount = 0;
      getActions().setDragHoveredNode(this.props.node.rootUri, this.props.node.uri);
    }
    this.dragEventCount++;
  }

  _onDragLeave(event: SyntheticDragEvent) {
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

  _onDragStart(event: SyntheticDragEvent) {
    event.stopPropagation();
    const target = this.refs.pathContainer;

    const fileIcon = target.cloneNode(false);
    fileIcon.style.cssText = 'position: absolute; top: 0; left: 0; color: #fff; opacity: .8;';
    document.body.appendChild(fileIcon);

    const nativeEvent = (event.nativeEvent: any);
    nativeEvent.dataTransfer.effectAllowed = 'move';
    nativeEvent.dataTransfer.setDragImage(fileIcon, -8, -4);
    nativeEvent.dataTransfer.setData('initialPath', this.props.node.uri);
    window.requestAnimationFrame(() => document.body.removeChild(fileIcon));
  }

  _onDragOver(event: SyntheticDragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  _onDrop(event: SyntheticDragEvent) {
    event.preventDefault();
    event.stopPropagation();

    // Reset the dragEventCount for the currently dragged node upon dropping.
    this.dragEventCount = 0;
    getActions().moveToNode(this.props.node.rootUri, this.props.node.uri);
  }

  _toggleNodeExpanded(deep: boolean): void {
    if (this.props.node.isExpanded) {
      if (deep) {
        getActions().collapseNodeDeep(this.props.node.rootUri, this.props.node.uri);
      } else {
        getActions().collapseNode(this.props.node.rootUri, this.props.node.uri);
      }
    } else {
      if (deep) {
        getActions().expandNodeDeep(this.props.node.rootUri, this.props.node.uri);
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
}
