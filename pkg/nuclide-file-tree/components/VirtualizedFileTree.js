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

import type {AppState, Roots} from '../lib/types';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import * as React from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';
import invariant from 'assert';
import Immutable from 'immutable';
import {connect} from 'react-redux';
import List from 'react-virtualized/dist/commonjs/List';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import * as Actions from '../lib/redux/Actions';
import FileTreeEntryComponent from './FileTreeEntryComponent';
import ProjectSelection from './ProjectSelection';
import {debounce, once} from 'lodash';

import type {FileTreeNode} from '../lib/FileTreeNode';
import * as Selectors from '../lib/redux/Selectors';

type State = {|
  rootHeight: ?number,
  nodeHeight: ?number,
  footerHeight: ?number,
|};

type Props = {|
  onMouseEnter: (event: SyntheticMouseEvent<>) => mixed,
  onMouseLeave: (event: SyntheticMouseEvent<>) => mixed,
  height: number,
  width: number,
  roots: Roots,
  trackedIndex: ?number,
  shownNodes: number,
  selectedNodes: Immutable.Set<FileTreeNode>,
  selectedNodeIndexes: Immutable.List<number>,
  focusedNodes: Immutable.Set<FileTreeNode>,
  isEditingWorkingSet: boolean,
  clearTrackedNodeIfNotLoading: () => void,
  getNodeByIndex: (index: number) => ?FileTreeNode,
|};

type RowType = 'root' | 'node' | 'footer';

const BUFFER_ELEMENTS = 10;
const DEFAULT_ROOT_HEIGHT = 30;
const DEFAULT_NODE_HEIGHT = 24;
const DEFAULT_FOOTER_HEIGHT = 74;

class VirtualizedFileTree extends React.PureComponent<Props, State> {
  _disposables: UniversalDisposable;

  _listRef: ?List;
  _rootRef: ?FileTreeEntryComponent;
  _nodeRef: ?FileTreeEntryComponent;
  _footerRef: ?ProjectSelection;
  _prevShownNodes: number = 0;
  _selectionWidth: number = 100;

  _indexOfFirstRowInView: number = 0;
  _indexOfLastRowInView: number = 0;

  constructor(props: Props) {
    super(props);
    this.state = {
      rootHeight: null,
      nodeHeight: null,
      footerHeight: null,
    };

    this._disposables = new UniversalDisposable();
  }

  componentDidMount(): void {
    this._disposables.add(
      // Remeasure if the theme changes, and on initial theme load, which may
      // happen after this component mounts.
      observableFromSubscribeFunction(cb =>
        atom.themes.onDidChangeActiveThemes(cb),
      )
        .startWith(null)
        .subscribe(() => {
          this._remeasureHeights(true);
        }),
    );
    this._updateSelectionWidth();
  }

  componentDidUpdate(prevProps: Props, prevState: State): void {
    this._remeasureHeights();
    const {shownNodes} = this.props;
    if (shownNodes !== this._prevShownNodes) {
      this._prevShownNodes = shownNodes;
      // Some folder was expanded/collaplsed or roots were modified.
      // In some themes the height of a root node is different from the height of plain node
      // The indices of root nodes could have changed -- we'll better recompute the heights

      if (this._listRef != null) {
        this._listRef.recomputeRowHeights();
      }
    }

    this._drawSelection();

    // When folders are expanded and collapsed, we need to get our selection width again.
    if (this.props.shownNodes !== prevProps.shownNodes) {
      this._updateSelectionWidth();
    }
  }

  // Render the selection indicators into the selection container element.
  //
  // This is a little bit of a weird pattern, but simple. Normally, we would put this logic into the
  // VirtualizedFileTree component's `render()`, however it needs to happen *after* the List
  // component has rendered (because it queries it for positions). The means we'd have to render
  // twice: once to render the grid and then again to update the selections with the grid
  // information. This was found to be less performant (cause more stalls).
  //
  // It's likely that with some refactoring, we could address this but we'd still need to use a
  // portal (since we're rendering the selection into a a node in the List) so this seems simpler.
  //
  // In future versions of React, this type of thing will be less hacky, since `useLayoutEffect`
  // will provide an explicit way to take actions after layout is complete but before we yield back
  // to the browser. (See https://reactjs.org/docs/hooks-reference.html#uselayouteffect)
  _drawSelection = () => {
    ReactDOM.render(
      <SelectionRenderer
        selectionWidth={this._selectionWidth}
        selectedNodeIndexes={this.props.selectedNodeIndexes}
        rowSizeAndPositionManager={
          this._listRef?.Grid?.state?.instanceProps?.rowSizeAndPositionManager
        }
        getRowHeight={this._rowHeight}
      />,
      this._getSelectionContainer(),
    );
  };

  _updateSelectionWidth = debounce(
    () => {
      const listEl = ReactDOM.findDOMNode(this._listRef);
      if (listEl == null || !(listEl instanceof HTMLElement)) {
        return;
      }
      const innerScrollContainer = listEl.querySelector(
        '.ReactVirtualized__Grid__innerScrollContainer',
      );
      if (innerScrollContainer == null) {
        return;
      }
      this._selectionWidth = innerScrollContainer.scrollWidth;
      this._drawSelection();
    },
    100,
    {leading: true, trailing: true},
  );

  _getSelectionContainer = once(() => {
    const el = document.createElement('div');
    Object.assign(el.style, {position: 'absolute', top: '0', left: '0'});
    return el;
  });

  componentWillUnmount(): void {
    this._disposables.dispose();
    ReactDOM.unmountComponentAtNode(this._getSelectionContainer());
  }

  // Used by `_remeasureHeights()` to determine whether we need to do any work.
  _invalidHeights = {
    root: true,
    node: true,
    footer: true,
  };

  /**
   * Measure the heights of file tree entry components, if needed. (We need to do this because
   * they're determined by the theme.) The actual work touches the DOM so we want to make sure we do
   * it only when the theme changes (and to get the initial values).
   *
   * One tricky thing is that it's not enough to just force a remeasure when the themes change as we
   * may not have nodes to measure at that point. Instead, we need to invalidate our measurements so
   * that, once we do have nodes, we remember to take new ones.
   *
   * IMPORTANT: This function is called a lot (on every update) so it's important that the normal
   * case (no measurement) be super cheap!
   *
   * FIXME: Because all nodes share the same ref, it's possible that one being removed could
   * result in the nulling of our ref even though there are still plenty of nodes to measure.
   * Subsequent remeasurements would then fail. In practice, this hasn't been an issue.
   */
  _remeasureHeights(invalidate: boolean = false): void {
    if (invalidate) {
      this._invalidHeights.root = true;
      this._invalidHeights.node = true;
      this._invalidHeights.footer = true;
    }

    let heightUpdated = false;
    const newState = {};

    if (this._rootRef != null && this._invalidHeights.root) {
      const rootNode = ReactDOM.findDOMNode(this._rootRef);
      if (rootNode != null) {
        invariant(rootNode instanceof HTMLElement);
        const rootHeight = rootNode.clientHeight;
        if (rootHeight > 0) {
          newState.rootHeight = rootHeight;
          heightUpdated = true;
          this._invalidHeights.root = false;
        }
      }
    }

    if (this._nodeRef != null && this._invalidHeights.node) {
      const node = ReactDOM.findDOMNode(this._nodeRef);
      if (node != null) {
        invariant(node instanceof HTMLElement);
        const nodeHeight = node.clientHeight;
        if (nodeHeight > 0) {
          newState.nodeHeight = nodeHeight;
          heightUpdated = true;
          this._invalidHeights.node = false;
        }
      }
    }

    if (this._footerRef != null && this._invalidHeights.footer) {
      const footer = ReactDOM.findDOMNode(this._footerRef);
      if (footer != null) {
        invariant(footer instanceof HTMLElement);
        const footerHeight = footer.clientHeight;
        if (footerHeight > 0) {
          newState.footerHeight = footerHeight;
          heightUpdated = true;
          this._invalidHeights.footer = false;
        }
      }
    }

    if (heightUpdated) {
      this.setState(newState);
      if (this._listRef != null) {
        this._listRef.recomputeRowHeights();
      }
    }
  }

  _handleScroll = () => {
    this._updateSelectionWidth();
  };

  render(): React.Node {
    const classes = {
      'nuclide-file-tree': true,
      'focusable-panel': true,
      'tree-view': true,
      'nuclide-file-tree-editing-working-set': this.props.isEditingWorkingSet,
    };

    const scrollToIndex = this.props.trackedIndex ?? -1;
    // If we're moving to an offscreen index, let's center it. Otherwise, we'll maintain the current
    // scroll position. In practice, this means centering only when the user used "Reveal in File
    // Tree" to show an offscreen file.
    const scrollToAlignment =
      scrollToIndex !== -1 &&
      (scrollToIndex <= this._indexOfFirstRowInView ||
        scrollToIndex >= this._indexOfLastRowInView)
        ? 'center'
        : 'auto';

    return (
      <div
        className={classnames(
          'list-tree',
          'has-collapsable-children',
          'file-tree-scroller',
          'nuclide-scrollbar-style-fix',
          classes,
        )}
        tabIndex={0}
        onMouseEnter={this.props.onMouseEnter}
        onMouseLeave={this.props.onMouseLeave}>
        <List
          height={this.props.height}
          width={this.props.width}
          onScroll={this._handleScroll}
          ref={this._setListRef}
          rowCount={this.props.shownNodes + 1}
          rowRenderer={this._rowRenderer}
          rowHeight={this._rowHeight}
          scrollToIndex={scrollToIndex}
          scrollToAlignment={scrollToAlignment}
          overscanRowCount={BUFFER_ELEMENTS}
          rootHeight={this.state.rootHeight}
          nodeHeight={this.state.nodeHeight}
          footerHeight={this.state.footerHeight}
          onRowsRendered={this._onRowsRendered}
          tabIndex={null}
          /*
          The normal react-virtualized styling doesn't allow us to scroll horizontally. The
          following rules make sure that (1) the inner element isn't cropped and (2) the parent
          element scrolls it.
          */
          containerStyle={{overflow: 'visible'}}
          style={{overflowX: 'auto'}}
          /* This is a workaround. React doesn't detect that a change in this component's state
            should affect the properties of this List's children. Maybe it's an interop problem
            with react-virtualized.
            To workaround this, we add the properties below as properties
            of the List element itself
            List does not use them, but they will give a hint to React that the component
            should be updated, and this will cause it to rerender its children.
          */
          roots={this.props.roots}
          selectedNodes={this.props.selectedNodes}
          focusedNodes={this.props.focusedNodes}
        />
      </div>
    );
  }

  _setListRef = (node: ?React$ElementRef<List>): void => {
    const prevNode = this._listRef;
    this._listRef = node;
    if (node !== prevNode) {
      // Attach an element into which we can render selection indicators.
      const selectionContainer = this._getSelectionContainer();
      selectionContainer.remove();
      const el = ReactDOM.findDOMNode(node);
      if (el != null && el instanceof HTMLElement) {
        el.prepend(selectionContainer);
      }
    }
  };

  // $FlowFixMe -- flow does not recognize FileTreeEntryComponent as React component
  _setRootRef = (node: ?React$ElementRef<FileTreeEntryComponent>): void => {
    this._rootRef = node;
  };

  // $FlowFixMe -- flow does not recognize FileTreeEntryComponent as React component
  _setNodeRef = (node: ?React$ElementRef<FileTreeEntryComponent>): void => {
    this._nodeRef = node;
  };

  // $FlowFixMe -- flow does not recognize ProjectSelection as React component
  _setFooterRef = (node: ?React$ElementRef<ProjectSelection>): void => {
    this._footerRef = node;
  };

  _rowHeight = (args: {index: number}): number => {
    const {index} = args;
    const rowType = this._rowTypeMapper(index);

    switch (rowType) {
      case 'root':
        return this.state.rootHeight == null
          ? DEFAULT_ROOT_HEIGHT
          : this.state.rootHeight;
      case 'node':
        return this.state.nodeHeight == null
          ? DEFAULT_NODE_HEIGHT
          : this.state.nodeHeight;
      default:
        return this.state.footerHeight == null
          ? DEFAULT_FOOTER_HEIGHT
          : this.state.footerHeight;
    }
  };

  _rowRenderer = (args: {
    index: number,
    isScrolling: boolean,
    key: string,
    parent: mixed,
    style: Object,
  }): ?React$Node => {
    const {index, key, style} = args;

    if (index === this.props.shownNodes) {
      // The footer
      return (
        <div key={key} style={style}>
          <ProjectSelection
            ref={this._setFooterRef}
            remeasureHeight={this._clearFooterHeight}
          />
        </div>
      );
    } else {
      const node = this.props.getNodeByIndex(index);
      if (node == null) {
        return null;
      }

      return (
        <div key={key} style={style}>
          <FileTreeEntryComponent
            // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
            ref={node.isRoot ? this._setRootRef : this._setNodeRef}
            node={node}
            selectedNodes={this.props.selectedNodes}
          />
        </div>
      );
    }
  };

  _onRowsRendered = (args: {
    overscanStartIndex: number,
    overscanStopIndex: number,
    startIndex: number,
    stopIndex: number,
  }): void => {
    const {startIndex, stopIndex} = args;
    this._indexOfFirstRowInView = startIndex;
    this._indexOfLastRowInView = stopIndex;
    const trackedIndex = this.props.trackedIndex;

    // Stop tracking the node once we've rendered it. If it was already visible when we set the
    // List's `scrollToIndex`, this will happen on the next render. That's fine though.
    if (
      trackedIndex != null &&
      trackedIndex >= startIndex &&
      trackedIndex <= stopIndex
    ) {
      this.props.clearTrackedNodeIfNotLoading();
    }
  };

  _clearFooterHeight = (): void => {
    this.setState({footerHeight: null});
  };

  _rowTypeMapper(rowIndex: number): RowType {
    if (rowIndex === this.props.shownNodes) {
      return 'footer';
    }

    const node = this.props.getNodeByIndex(rowIndex);
    if (node != null) {
      return node.isRoot ? 'root' : 'node';
    }

    return 'footer';
  }
}

type SelectionRendererProps = {|
  selectionWidth: number,
  selectedNodeIndexes: Immutable.List<number>,
  rowSizeAndPositionManager: ?{
    getSizeAndPositionOfCell: number => {offset: number},
    getCellCount: () => number,
  },
  getRowHeight: ?(args: {index: number}) => number,
|};

class SelectionRenderer extends React.Component<SelectionRendererProps> {
  shouldComponentUpdate(nextProps: SelectionRendererProps): boolean {
    if (
      nextProps.getRowHeight !== this.props.getRowHeight ||
      nextProps.rowSizeAndPositionManager !==
        this.props.rowSizeAndPositionManager ||
      nextProps.selectionWidth !== this.props.selectionWidth ||
      !nextProps.selectedNodeIndexes.equals(this.props.selectedNodeIndexes)
    ) {
      return true;
    }
    return false;
  }

  render() {
    const {
      rowSizeAndPositionManager,
      selectionWidth,
      selectedNodeIndexes,
      getRowHeight,
    } = this.props;

    if (rowSizeAndPositionManager == null || getRowHeight == null) {
      // Can't measure.
      return null;
    }

    const selections = selectedNodeIndexes
      .toArray()
      .map((index, i) => {
        const realIndex = index - 1; // Indexes are 1-based for some reason.
        // This is a hacky (but the only) way to get the position of the cell. This is necessary
        // to render the selection behind the entry elements (which we do so as not to change the
        // scroll width of the entry elements' container).
        const isValidSelection =
          realIndex >= 0 &&
          realIndex < rowSizeAndPositionManager.getCellCount();
        if (!isValidSelection) {
          return null;
        }
        const top = rowSizeAndPositionManager.getSizeAndPositionOfCell(
          realIndex,
        ).offset;
        const height = getRowHeight({index: realIndex});
        return (
          <Selection key={i} width={selectionWidth} height={height} top={top} />
        );
      })
      .filter(Boolean);

    return <>{selections}</>;
  }
}

type SelectionProps = {|
  top: number,
  width: number,
  height: number,
|};

function Selection(props: SelectionProps) {
  return (
    <div
      className="selection-indicator selected"
      style={{
        position: 'absolute',
        top: `${props.top}px`,
        width: `${props.width}px`,
        height: `${props.height}px`,
      }}
    />
  );
}

// A version of `Selectors.getNodeByIndex()` that's optimized for sequential access.
const getNodeByIndex = (() => {
  let prevRoots;
  let prevIndexQuery = -1;
  let prevNode: ?FileTreeNode = null;

  const fallbackGetByIndex = (state: AppState, index: number) => {
    prevRoots = Selectors.getRoots(state);
    prevIndexQuery = index;
    prevNode = Selectors.getNodeByIndex(state)(index + 1);
    return prevNode;
  };

  return (state: AppState, index: number) => {
    const roots = Selectors.getRoots(state);
    if (roots !== prevRoots) {
      // The tree structure was updated
      return fallbackGetByIndex(state, index);
    }

    if (index === prevIndexQuery) {
      return prevNode;
    }

    if (index === prevIndexQuery + 1) {
      // The likely case when we're moving forward in our scanning - FileTreeNode has
      // more efficient utility to find the next node - we prefer that to a naive scanning
      // from the root of the tree

      prevIndexQuery = index;
      if (prevNode == null) {
        return null;
      }

      prevNode = Selectors.findNext(state)(prevNode);
      return prevNode;
    }

    return fallbackGetByIndex(state, index);
  };
})();

const mapStateToProps = (state: AppState, ownProps): $Shape<Props> => ({
  roots: Selectors.getRoots(state),
  selectedNodes: Selectors.getSelectedNodes(state).toSet(),
  selectedNodeIndexes: Selectors.getVisualIndexOfSelectedNodes(state),
  focusedNodes: Selectors.getFocusedNodes(state).toSet(),
  isEditingWorkingSet: Selectors.getIsEditingWorkingSet(state),
  getNodeByIndex: index => getNodeByIndex(state, index),
  shownNodes: Selectors.countShownNodes(state),
  trackedIndex: Selectors.getTrackedIndex(state),
});

const mapDispatchToProps = (dispatch, ownProps): $Shape<Props> => ({
  clearTrackedNodeIfNotLoading: () => {
    dispatch(Actions.clearTrackedNodeIfNotLoading());
  },
});

// $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
export default connect(
  mapStateToProps,
  // $FlowFixMe (>=0.85.0) (T35986896) Flow upgrade suppress
  mapDispatchToProps,
)(VirtualizedFileTree);
