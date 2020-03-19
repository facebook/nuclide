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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {FileTreeNode} from '../lib/FileTreeNode';
import type Immutable from 'immutable';
import type {AppState, NodeCheckedStatus} from '../lib/types';
import type {StatusCodeNumberValue} from '../../nuclide-hg-rpc/lib/types';

import {dragEventCameFromDraggableFile} from 'nuclide-commons-ui/DraggableFile';
import {connect} from 'react-redux';
import * as FileTreeHelpers from '../lib/FileTreeHelpers';
import * as Selectors from '../lib/redux/Selectors';
import * as Actions from '../lib/redux/Actions';
import * as React from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import {nextAnimationFrame} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nullthrows from 'nullthrows';
import {filterName} from '../lib/FileTreeFilterHelper';
import {Checkbox} from 'nuclide-commons-ui/Checkbox';
import {StatusCodeNumber} from '../../nuclide-hg-rpc/lib/hg-constants';
import * as FileTreeHgHelpers from '../lib/FileTreeHgHelpers';
import addTooltip from 'nuclide-commons-ui/addTooltip';
import PathWithFileIcon from 'nuclide-commons-ui/PathWithFileIcon';
import invariant from 'assert';
import {Observable} from 'rxjs';

type Props = {|
  node: FileTreeNode,
  isSelected: boolean,
  isFocused: boolean,
  isPreview?: boolean,
  usePreviewTabs: boolean,
  isEditingWorkingSet: boolean,
  vcsStatusCode: StatusCodeNumberValue,
  isContainer: boolean,
  isIgnored: boolean,
  checkedStatus: NodeCheckedStatus,
  shouldBeSoftened: boolean,

  // TODO: Hoist the logic for responding to drags to VirtualizedFileTree. (This component should
  // just report via props when it's been dragged into, etc.) Then we can remove the
  // `selectedNodes` prop entirely (since it's the only thing that needs more than `isSelected`).
  //
  // IMPORTANT: This is not considered in `shouldComponentUpdate()`. If it were, we'd re-render
  // every FileTreeEntryComponent on every selection change.
  selectedNodes: Immutable.List<FileTreeNode>,

  expandNode: () => void,
  expandNodeDeep: () => void,
  checkNode: () => void,
  uncheckNode: () => void,
  collapseNode: () => void,
  collapseNodeDeep: () => void,
  clearTrackedNode: () => void,
  addSelectedNode: () => void,
  rangeSelectToNode: () => void,
  setSelectedNode: () => void,
  unselectNode: () => void,
  confirmNode: (pending: boolean) => void,
  reorderDragInto: () => void,
  setDragHoveredNode: () => void,
  setFocusedNode: () => void,
  unhoverNode: () => void,
  startReorderDrag: () => void,
  endReorderDrag: () => void,
  reorderRoots: () => void,
  moveToNode: () => void,
  uploadDroppedFiles: (files: FileList) => void,
  canTransferFiles: boolean,
  movePathToNode: NuclideUri => void,
|};

type State = {|
  isLoading: boolean,
|};

const SUBSEQUENT_FETCH_SPINNER_DELAY = 500;
const INITIAL_FETCH_SPINNER_DELAY = 25;
const INDENT_LEVEL = 17;
const FILE_TREE_DRAG_SOURCE = 'file-tree';

class FileTreeEntryComponent extends React.Component<Props, State> {
  _arrowContainer: ?HTMLElement;
  _loadingTimeout: ?TimeoutID;
  _disposables: ?UniversalDisposable;
  _pathContainer: ?HTMLElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      isLoading: props.node.isLoading,
    };
  }

  /**
   * react-redux will cause a rerender every time because it remaps the dispatch props. Therefore
   * we can't use PureComponent.
   */
  shouldComponentUpdate(nextProps: Props, nextState: State): boolean {
    return (
      nextProps.node !== this.props.node ||
      nextProps.isSelected !== this.props.isSelected ||
      nextProps.isFocused !== this.props.isFocused ||
      nextProps.isPreview !== this.props.isPreview ||
      nextProps.usePreviewTabs !== this.props.usePreviewTabs ||
      nextProps.isEditingWorkingSet !== this.props.isEditingWorkingSet ||
      nextProps.vcsStatusCode !== this.props.vcsStatusCode ||
      nextProps.isContainer !== this.props.isContainer ||
      nextProps.isIgnored !== this.props.isIgnored ||
      nextProps.checkedStatus !== this.props.checkedStatus ||
      nextProps.shouldBeSoftened !== this.props.shouldBeSoftened ||
      nextState.isLoading !== this.state.isLoading
    );
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props): void {
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
      Observable.fromEvent(el, 'dragend').subscribe(this._onDragEnd),
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

  render(): React.Node {
    const {
      checkedStatus,
      node,
      isContainer,
      isIgnored,
      isSelected,
      shouldBeSoftened,
      vcsStatusCode,
    } = this.props;

    const outerClassName = classnames('entry', {
      'file list-item': !isContainer,
      'directory list-nested-item': isContainer,
      'current-working-directory': node.isCwd,
      collapsed: !node.isLoading && !node.isExpanded,
      expanded: !node.isLoading && node.isExpanded,
      'project-root': node.isRoot,
      selected: isSelected || node.isDragHovered,
      'nuclide-file-tree-softened': shouldBeSoftened,
      'nuclide-file-tree-root-being-reordered': node.isBeingReordered,
      'nuclide-file-tree-entry-item': true,
    });
    const listItemClassName = classnames({
      'header list-item': isContainer,
      loading: this.state.isLoading,
    });

    let statusClass;
    if (!this.props.isEditingWorkingSet) {
      if (vcsStatusCode === StatusCodeNumber.MODIFIED) {
        statusClass = 'status-modified';
      } else if (vcsStatusCode === StatusCodeNumber.ADDED) {
        statusClass = 'status-added';
      } else if (isIgnored) {
        statusClass = 'status-ignored';
      } else {
        statusClass = '';
      }
    } else {
      switch (checkedStatus) {
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

    let generatedClass;
    if (node.generatedStatus === 'generated') {
      generatedClass = 'generated-fully';
    } else if (node.generatedStatus === 'partial') {
      generatedClass = 'generated-partly';
    } else {
      generatedClass = '';
    }

    let tooltip;
    if (isContainer) {
      if (node.isCwd) {
        tooltip = addTooltip({title: 'Current Working Root'});
      }
    }

    return (
      <li
        className={classnames(outerClassName, statusClass, generatedClass, {
          // `atom/find-and-replace` looks for this class to determine if a
          // data-path is a directory or not:
          directory: isContainer,
        })}
        style={{
          paddingLeft: isContainer
            ? this.props.node.getDepth() * INDENT_LEVEL
            : // Folders typically render a disclosure triangle, making them appear
              // at one depth level more than they actually are. Compensate by
              // adding the appearance of an extra level of depth for files.
              this.props.node.getDepth() * INDENT_LEVEL + INDENT_LEVEL,
          marginLeft: 0,
        }}
        draggable={true}
        onMouseDown={this._onMouseDown}
        onClick={this._onClick}
        onDoubleClick={this._onDoubleClick}
        data-name={node.name}
        data-path={node.uri}>
        <div
          className={listItemClassName}
          // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
          ref={el => {
            this._arrowContainer = el;
          }}>
          <PathWithFileIcon
            className={classnames('name', 'nuclide-file-tree-path', {
              'icon-nuclicon-file-directory': isContainer && !node.isCwd,
              'icon-nuclicon-file-directory-starred': isContainer && node.isCwd,
            })}
            isFolder={isContainer}
            path={node.uri}
            // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
            ref={elem => {
              // $FlowFixMe(>=0.53.0) Flow suppress
              this._pathContainer = elem;
              tooltip && tooltip(elem);
            }}
            data-name={node.name}
            data-path={node.uri}>
            {this._renderCheckbox()}
            {filterName(node.name, node.highlightedText, isSelected)}
          </PathWithFileIcon>
          {this._renderConnectionTitle()}
        </div>
      </li>
    );
  }

  _renderCheckbox(): ?React.Element<any> {
    if (!this.props.isEditingWorkingSet) {
      return;
    }

    return (
      <Checkbox
        checked={this.props.checkedStatus === 'checked'}
        indeterminate={this.props.checkedStatus === 'partial'}
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

  _isToggleNodeExpand(event: SyntheticMouseEvent<>) {
    if (!this._pathContainer) {
      return;
    }

    const shouldToggleExpand =
      this.props.isContainer &&
      // $FlowFixMe
      nullthrows(this._arrowContainer).contains(event.target) &&
      event.clientX <
        // $FlowFixMe
        ReactDOM.findDOMNode(this._pathContainer).getBoundingClientRect().left;
    if (shouldToggleExpand) {
      this.props.clearTrackedNode();
    }

    return shouldToggleExpand;
  }

  _onMouseDown = (event: SyntheticMouseEvent<>) => {
    event.stopPropagation();
    if (this._isToggleNodeExpand(event)) {
      return;
    }

    const {isSelected} = this.props;
    const selectionMode = FileTreeHelpers.getSelectionMode(event);
    if (selectionMode === 'multi-select' && !isSelected) {
      this.props.addSelectedNode();
    } else if (selectionMode === 'range-select') {
      this.props.rangeSelectToNode();
    } else if (selectionMode === 'single-select' && !isSelected) {
      this.props.setSelectedNode();
    }
  };

  _onClick = (event: SyntheticMouseEvent<>) => {
    event.stopPropagation();
    const {isContainer, isSelected, isFocused} = this.props;
    const deep = event.altKey;
    if (this._isToggleNodeExpand(event)) {
      this._toggleNodeExpanded(deep);
      return;
    }

    const selectionMode = FileTreeHelpers.getSelectionMode(event);

    if (
      selectionMode === 'range-select' ||
      selectionMode === 'invalid-select'
    ) {
      return;
    }

    if (selectionMode === 'multi-select') {
      if (isFocused) {
        this.props.unselectNode();
        // If this node was just unselected, immediately return and skip
        // the statement below that sets this node to focused.
        return;
      }
    } else {
      if (isContainer) {
        if (isFocused || this.props.usePreviewTabs) {
          this._toggleNodeExpanded(deep);
        }
      } else {
        if (this.props.usePreviewTabs) {
          this.props.confirmNode(true);
        }
      }
      // Set selected node to clear any other selected nodes (i.e. in the case of
      // previously having multiple selections).
      this.props.setSelectedNode();
    }

    if (isSelected) {
      this.props.setFocusedNode();
    }
  };

  _onDoubleClick = (event: SyntheticMouseEvent<>) => {
    event.stopPropagation();

    if (this.props.isContainer) {
      return;
    }

    this.props.confirmNode(false);
  };

  _onDragEnter = (event: DragEvent) => {
    event.stopPropagation();
    // $FlowFixMe Flow does not know that currentTarget is a full DOM node.
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    if (!this.props.isContainer) {
      return;
    }

    const {selectedNodes} = this.props;
    const singleRootNodeIsSelected =
      !this.props.isPreview &&
      selectedNodes.size === 1 &&
      nullthrows(selectedNodes.first()).isRoot;

    const movableNodes = selectedNodes.filter(node =>
      FileTreeHgHelpers.isValidRename(node.uri, this.props.node.uri),
    );

    const haveUploadableOSFiles =
      this.props.canTransferFiles &&
      event.dataTransfer &&
      event.dataTransfer.types.includes('Files');

    if (dragEventCameFromDraggableFile(event)) {
      // Ideally we would check to see if the rename was valid, but we don't have permission to peek inside the dataTransfer data.
      this.props.setDragHoveredNode();
    } else if (haveUploadableOSFiles) {
      this.props.setDragHoveredNode();
    } else if (singleRootNodeIsSelected) {
      this.props.reorderDragInto();
    } else if (movableNodes.size > 0) {
      this.props.setDragHoveredNode();
    }
  };

  _onDragLeave = (event: DragEvent) => {
    event.stopPropagation();
    // $FlowFixMe Flow does not know that currentTarget is a full DOM node.
    if (event.currentTarget.contains(event.relatedTarget)) {
      return;
    }
    this.props.unhoverNode();
  };

  _onDragStart = (event: DragEvent) => {
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
      dataTransfer.setData('nuclideSource', FILE_TREE_DRAG_SOURCE);
    }
    // eslint-disable-next-line nuclide-internal/unused-subscription
    nextAnimationFrame.subscribe(() => {
      invariant(document.body != null);
      document.body.removeChild(fileIcon);
    });

    if (this.props.node.isRoot) {
      this.props.startReorderDrag();
    }
  };

  _onDragOver = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  _onDragEnd = (event: DragEvent) => {
    if (this.props.node.isRoot) {
      this.props.endReorderDrag();
    }
  };

  _onDrop = (event: DragEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const externalDragPath = getExternalDragPath(event);

    const dragNode =
      this.props.selectedNodes.size === 1
        ? this.props.selectedNodes.first()
        : null;

    const files = event.dataTransfer?.files;

    if (externalDragPath != null) {
      this.props.movePathToNode(externalDragPath);
    } else if (files && files.length && this.props.canTransferFiles) {
      if (this.props.isContainer) {
        this.props.uploadDroppedFiles(files);
      } else {
        // TODO: Show warning
      }
    } else if (dragNode != null && dragNode.isRoot) {
      this.props.reorderRoots();
    } else {
      this.props.moveToNode();
    }
  };

  _toggleNodeExpanded(deep: boolean): void {
    if (this.props.node.isExpanded) {
      if (deep) {
        this.props.collapseNodeDeep();
      } else {
        this.props.collapseNode();
      }
    } else {
      if (deep) {
        this.props.expandNodeDeep();
      } else {
        this.props.expandNode();
      }
    }
  }

  _checkboxOnChange = (isChecked: boolean): void => {
    if (isChecked) {
      this.props.checkNode();
    } else {
      this.props.uncheckNode();
    }
  };

  _checkboxOnClick = (event: SyntheticEvent<>): void => {
    event.stopPropagation();
  };

  _checkboxOnMouseDown = (event: SyntheticMouseEvent<>): void => {
    // Chrome messes with scrolling if a focused input is being scrolled out of view
    // so we'll just prevent the checkbox from receiving the focus
    event.preventDefault();
  };
}

const mapStateToProps = (state: AppState, ownProps): $Shape<Props> => ({
  isSelected: Selectors.getSelectedNodes(state).includes(ownProps.node),
  isFocused: Selectors.getFocusedNodes(state).includes(ownProps.node),
  usePreviewTabs: Selectors.getUsePreviewTabs(state),
  isEditingWorkingSet: Selectors.getIsEditingWorkingSet(state),
  canTransferFiles: Selectors.getCanTransferFiles(state),
  vcsStatusCode: Selectors.getVcsStatus(state)(ownProps.node),
  isContainer: Selectors.getNodeIsContainer(state)(ownProps.node),
  isIgnored: Selectors.getNodeIsIgnored(state)(ownProps.node),
  checkedStatus: Selectors.getNodeCheckedStatus(state)(ownProps.node),
});

const mapDispatchToProps = (dispatch, ownProps): $Shape<Props> => ({
  clearTrackedNode: () => {
    dispatch(Actions.clearTrackedNode());
  },
  rangeSelectToNode: () => {
    dispatch(
      Actions.rangeSelectToNode(ownProps.node.rootUri, ownProps.node.uri),
    );
  },
  confirmNode: pending => {
    dispatch(
      Actions.confirmNode(ownProps.node.rootUri, ownProps.node.uri, pending),
    );
  },
  unselectNode: () => {
    dispatch(Actions.unselectNode(ownProps.node.rootUri, ownProps.node.uri));
  },
  setSelectedNode: () => {
    dispatch(Actions.setSelectedNode(ownProps.node.rootUri, ownProps.node.uri));
  },
  addSelectedNode: () => {
    dispatch(Actions.addSelectedNode(ownProps.node.rootUri, ownProps.node.uri));
  },
  collapseNode: () => {
    dispatch(Actions.collapseNode(ownProps.node.rootUri, ownProps.node.uri));
  },
  collapseNodeDeep: () => {
    dispatch(
      Actions.collapseNodeDeep(ownProps.node.rootUri, ownProps.node.uri),
    );
  },
  checkNode: () => {
    dispatch(Actions.checkNode(ownProps.node.rootUri, ownProps.node.uri));
  },
  uncheckNode: () => {
    dispatch(Actions.uncheckNode(ownProps.node.rootUri, ownProps.node.uri));
  },
  expandNode: () => {
    dispatch(Actions.expandNode(ownProps.node.rootUri, ownProps.node.uri));
  },
  expandNodeDeep: () => {
    dispatch(Actions.expandNodeDeep(ownProps.node.rootUri, ownProps.node.uri));
  },
  reorderDragInto: () => {
    dispatch(Actions.reorderDragInto(ownProps.node.rootUri));
  },
  setDragHoveredNode: () => {
    dispatch(
      Actions.setDragHoveredNode(ownProps.node.rootUri, ownProps.node.uri),
    );
  },
  setFocusedNode: () => {
    dispatch(Actions.setFocusedNode(ownProps.node.rootUri, ownProps.node.uri));
  },
  unhoverNode: () => {
    dispatch(Actions.unhoverNode(ownProps.node.rootUri, ownProps.node.uri));
  },
  startReorderDrag: () => {
    dispatch(Actions.startReorderDrag(ownProps.node.uri));
  },
  endReorderDrag: () => {
    dispatch(Actions.endReorderDrag());
  },
  reorderRoots: () => {
    dispatch(Actions.reorderRoots());
  },
  moveToNode: () => {
    dispatch(Actions.moveToNode(ownProps.node.rootUri, ownProps.node.uri));
  },
  uploadDroppedFiles: (files: FileList) => {
    dispatch(Actions.uploadDroppedFiles(ownProps.node, files));
  },
  movePathToNode: (uri: NuclideUri) => {
    dispatch(Actions.movePathToNode(uri, ownProps.node));
  },
});

function getExternalDragPath(event: DragEvent): ?NuclideUri {
  const {dataTransfer} = event;
  if (dataTransfer == null) {
    return null;
  }
  const nuclideSource = dataTransfer.getData('nuclideSource');
  // For drag events within File Tree we use the selected nodes not `dataTransfer`.
  // Ignore these events.
  if (nuclideSource === FILE_TREE_DRAG_SOURCE) {
    return null;
  }

  // This is what <DraggableFile> uses.
  const initialPath = dataTransfer.getData('initialPath');
  // This is what https://github.com/atom/tabs uses.
  const textPlain = dataTransfer.getData('text/plain');

  // `dataTransfer.getData()` returns empty string if the value has not been set.
  return initialPath || textPlain || null;
}

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export default connect(
  mapStateToProps,
  // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
  mapDispatchToProps,
)(FileTreeEntryComponent);
