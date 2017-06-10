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
import React from 'react';
import ReactDOM from 'react-dom';
import {FileTreeEntryComponent} from './FileTreeEntryComponent';
import {ProjectSelection} from './ProjectSelection';
import classnames from 'classnames';

import type {OrderedMap} from 'immutable';
import type {FileTreeNode} from '../lib/FileTreeNode';

type State = {
  elementHeight: number,
};

type Props = {
  containerHeight: number,
  containerScrollTop: number,
  scrollToPosition: (top: number, height: number) => void,
};

const BUFFER_ELEMENTS = 15;

export class FileTree extends React.Component {
  state: State;
  props: Props;
  _store: FileTreeStore;
  _initialHeightMeasured: boolean;
  _disposables: UniversalDisposable;

  constructor(props: Props) {
    super(props);
    this._store = FileTreeStore.getInstance();
    this._disposables = new UniversalDisposable();

    this.state = {
      elementHeight: 22, // The minimal observed height makes a good default
    };

    this._initialHeightMeasured = false;
    (this: any)._measureHeights = this._measureHeights.bind(this);
  }

  componentDidMount(): void {
    this._scrollToTrackedNodeIfNeeded();
    this._measureHeights();
    window.addEventListener('resize', this._measureHeights);

    this._disposables.add(
      atom.themes.onDidChangeActiveThemes(() => {
        this._initialHeightMeasured = false;
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
    if (!this._initialHeightMeasured) {
      this._measureHeights();
    }

    this._scrollToTrackedNodeIfNeeded();
  }

  _scrollToTrackedNodeIfNeeded(): void {
    const trackedIndex = findIndexOfTheTrackedNode(this._store.roots);
    if (trackedIndex < 0) {
      return;
    }

    this.props.scrollToPosition(
      trackedIndex * this.state.elementHeight,
      this.state.elementHeight,
    );
  }

  _measureHeights(): void {
    const measuredComponent = this.refs.measured;
    if (measuredComponent == null) {
      return;
    }

    this._initialHeightMeasured = true;

    const node = ReactDOM.findDOMNode(measuredComponent);
    // $FlowFixMe
    const elementHeight = node.clientHeight;
    if (elementHeight !== this.state.elementHeight && elementHeight > 0) {
      this.setState({elementHeight});
    }
  }

  render(): React.Element<any> {
    const classes = {
      'nuclide-file-tree': true,
      'focusable-panel': true,
      'tree-view': true,
      'nuclide-file-tree-editing-working-set': this._store.isEditingWorkingSet(),
    };

    return (
      <div className={classnames(classes)} tabIndex={0}>
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
        visibleChildren.push(
          <FileTreeEntryComponent key={key} node={node} ref="measured" />,
        );
        chosenMeasured = true;
      } else {
        visibleChildren.push(<FileTreeEntryComponent key={key} node={node} />);
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
    if (skipped + r.shownChildrenBelow > firstToRender) {
      return true;
    }

    skipped += r.shownChildrenBelow;
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

function findIndexOfTheTrackedNode(
  nodes: OrderedMap<mixed, FileTreeNode>,
): number {
  let skipped = 0;
  const trackedNodeRoot = nodes.find(node => {
    if (node.containsTrackedNode) {
      return true;
    }

    skipped += node.shownChildrenBelow;
    return false;
  });

  if (trackedNodeRoot == null) {
    return -1;
  }

  if (trackedNodeRoot.isTracked) {
    return skipped;
  }

  return skipped + 1 + findIndexOfTheTrackedNode(trackedNodeRoot.children);
}

function countShownNodes(roots: OrderedMap<mixed, FileTreeNode>): number {
  return roots.reduce((sum, root) => sum + root.shownChildrenBelow, 0);
}
