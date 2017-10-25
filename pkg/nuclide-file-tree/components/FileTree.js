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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {nextAnimationFrame} from 'nuclide-commons/observable';
import {FileTreeStore} from '../lib/FileTreeStore';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {FileTreeEntryComponent} from './FileTreeEntryComponent';
import {ProjectSelection} from './ProjectSelection';
import classnames from 'classnames';

// flowlint-next-line untyped-type-import:off
import type {OrderedMap} from 'immutable';
import type {FileTreeNode} from '../lib/FileTreeNode';

type State = {
  elementHeight: number,
  initialHeightMeasured: boolean,
};

type Props = {
  containerHeight: number,
  containerScrollTop: number,
  scrollToPosition: (top: number, height: number, approximate: boolean) => void,
  onMouseEnter: (event: SyntheticMouseEvent<>) => mixed,
  onMouseLeave: (event: SyntheticMouseEvent<>) => mixed,
};

const BUFFER_ELEMENTS = 15;

export class FileTree extends React.Component<Props, State> {
  _store: FileTreeStore;
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._store = FileTreeStore.getInstance();
    this._disposables = new UniversalDisposable();

    this.state = {
      elementHeight: 22, // The minimal observed height makes a good default
      initialHeightMeasured: false,
    };
  }

  componentDidMount(): void {
    setImmediate(() => {
      // Parent refs are not avalaible until _after_ children have mounted, so
      // must wait to update the tracked node until our parent has a reference
      // to our root DOM node.
      this._scrollToTrackedNodeIfNeeded();
    });
    this._measureHeights();
    window.addEventListener('resize', this._measureHeights);

    this._disposables.add(
      atom.themes.onDidChangeActiveThemes(() => {
        this.setState({initialHeightMeasured: false});
        const sub = nextAnimationFrame.subscribe(() => {
          this._disposables.remove(sub);
          this._measureHeights();
        });
        this._disposables.add(sub);
      }),
      () => {
        window.removeEventListener('resize', this._measureHeights);
      },
    );
  }

  componentWillUnmount(): void {
    this._disposables.dispose();
  }

  componentDidUpdate(): void {
    if (!this.state.initialHeightMeasured) {
      this._measureHeights();
    }

    this._scrollToTrackedNodeIfNeeded();
  }

  _scrollToTrackedNodeIfNeeded(): void {
    const trackedIndex = findIndexOfTheTrackedNode(this._store);
    if (trackedIndex < 0) {
      return;
    }

    const positionIsApproximate = !this.state.initialHeightMeasured;

    this.props.scrollToPosition(
      trackedIndex * this.state.elementHeight,
      this.state.elementHeight,
      positionIsApproximate,
    );
  }

  _measureHeights = (): void => {
    const measuredComponent = this.refs.measured;
    if (measuredComponent == null) {
      return;
    }

    const node = ReactDOM.findDOMNode(measuredComponent);

    // $FlowFixMe
    const elementHeight = node.clientHeight;
    if (elementHeight > 0) {
      this.setState({
        elementHeight,
        initialHeightMeasured: true,
      });
    }
  };

  render(): React.Node {
    const classes = {
      'nuclide-file-tree': true,
      'focusable-panel': true,
      'tree-view': true,
      'nuclide-file-tree-editing-working-set': this._store.isEditingWorkingSet(),
    };

    return (
      <div
        className={classnames(classes)}
        tabIndex={0}
        onMouseEnter={this.props.onMouseEnter}
        onMouseLeave={this.props.onMouseLeave}>
        {this._renderChildren()}
      </div>
    );
  }

  _renderChildren(): React.Element<any> {
    const roots = this._store.roots;
    const childrenCount = countShownNodes(roots);

    if (childrenCount === 0) {
      return <ProjectSelection />;
    }

    const scrollTop = this.props.containerScrollTop;
    const containerHeight = this.props.containerHeight;
    const elementHeight = this.state.elementHeight;
    const elementsInView = Math.ceil(containerHeight / elementHeight);
    let firstToRender = Math.floor(scrollTop / elementHeight) - BUFFER_ELEMENTS;
    // The container might have been scrolled too far for the current elements
    if (firstToRender > childrenCount - elementsInView) {
      firstToRender = childrenCount - elementsInView;
    }
    firstToRender = Math.max(firstToRender, 0);
    const amountToRender = elementsInView + 2 * BUFFER_ELEMENTS;

    let reorderPreview: ?{
      entry: React.Element<any>,
      above: boolean,
      target: string,
    };
    const reorderPreviewStatus = this._store.reorderPreviewStatus;
    if (reorderPreviewStatus != null) {
      const source = reorderPreviewStatus.source;
      const sourceNode = this._store.getNode(source, source);
      const sourceIdx = reorderPreviewStatus.sourceIdx;
      const target = reorderPreviewStatus.target;
      const targetIdx = reorderPreviewStatus.targetIdx;
      if (
        sourceNode != null &&
        target != null &&
        targetIdx != null &&
        targetIdx !== sourceIdx
      ) {
        reorderPreview = {
          entry: (
            <FileTreeEntryComponent
              node={sourceNode}
              isPreview={true}
              selectedNodes={this._store.selectionManager.selectedNodes()}
              focusedNodes={this._store.selectionManager.focusedNodes()}
            />
          ),
          above: targetIdx < sourceIdx,
          target,
        };
      }
    }

    const visibleChildren = [];
    let chosenMeasured = false;
    let node = findFirstNodeToRender(roots, firstToRender);

    // The chosen key is intentionally non-unique. This is to force React to reuse nodes
    // when scrolling is performed, rather then delete one and create another.
    // The selected key is a node's index modulo the amount of the rendered nodes. This way,
    // when a node is scrolled out of the view, another is added with just the same index.
    // Were React allowed to delete and creates nodes at its will it would have caused an
    // abrupt stop in the scrolling process.
    // See: https://github.com/facebook/react/issues/2295
    let key = firstToRender % amountToRender;
    while (node != null && visibleChildren.length < amountToRender) {
      if (!node.isRoot && !chosenMeasured) {
        const entry = (
          <FileTreeEntryComponent
            key={key}
            node={node}
            selectedNodes={this._store.selectionManager.selectedNodes()}
            focusedNodes={this._store.selectionManager.focusedNodes()}
            ref="measured"
          />
        );
        if (reorderPreview != null && reorderPreview.target === node.uri) {
          if (reorderPreview.above) {
            visibleChildren.push(reorderPreview.entry, entry);
          } else {
            visibleChildren.push(entry, reorderPreview.entry);
          }
        } else {
          visibleChildren.push(entry);
        }
        chosenMeasured = true;
      } else {
        const entry = (
          <FileTreeEntryComponent
            key={key}
            node={node}
            selectedNodes={this._store.selectionManager.selectedNodes()}
            focusedNodes={this._store.selectionManager.focusedNodes()}
          />
        );
        if (reorderPreview != null && reorderPreview.target === node.uri) {
          if (reorderPreview.above) {
            visibleChildren.push(reorderPreview.entry, entry);
          } else {
            visibleChildren.push(entry, reorderPreview.entry);
          }
        } else {
          visibleChildren.push(entry);
        }
      }
      node = node.findNext();
      key = (key + 1) % amountToRender;
    }

    const topPlaceholderSize = firstToRender * elementHeight;
    const bottomPlaceholderCount =
      childrenCount - (firstToRender + visibleChildren.length);
    const bottomPlaceholderSize = bottomPlaceholderCount * elementHeight;

    return (
      <div>
        <div style={{height: topPlaceholderSize + 'px'}} />
        <ul className="list-tree has-collapsable-children">
          {visibleChildren}
        </ul>
        <div style={{height: bottomPlaceholderSize + 'px'}} />
        <ProjectSelection />
      </div>
    );
  }
}

function findFirstNodeToRender(
  roots: OrderedMap<mixed, FileTreeNode>,
  firstToRender: number,
): ?FileTreeNode {
  let skipped = 0;

  const node = roots.find(r => {
    if (skipped + r.shownChildrenCount > firstToRender) {
      return true;
    }

    skipped += r.shownChildrenCount;
    return false;
  });

  if (node == null) {
    return null;
  }

  if (skipped === firstToRender) {
    return node;
  }

  // The result is under this root, but not the root itself - skipping it and searching recursively
  return findFirstNodeToRender(node.children, firstToRender - skipped - 1);
}

function findIndexOfTheTrackedNode(store: FileTreeStore): number {
  const trackedNode = store.getTrackedNode();
  if (trackedNode == null) {
    return -1;
  }

  return trackedNode.calculateVisualIndex();
}

function countShownNodes(roots: OrderedMap<mixed, FileTreeNode>): number {
  return roots.reduce((sum, root) => sum + root.shownChildrenCount, 0);
}
