/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

/* eslint-env browser */

import {arrayEqual, arrayFindLastIndex} from 'nuclide-commons/collection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import classnames from 'classnames';
import invariant from 'assert';
import {Observable} from 'rxjs';
import shallowEqual from 'shallowequal';
import nullthrows from 'nullthrows';
import {scrollIntoView} from './scrollIntoView';
import {TreeList} from './Tree';

export type NodePath = Array<number>;
export type TreeNode = TreeLeafNode | TreeNestedNode;

type TreeLeafNode = {|
  type: 'LEAF',
  label: React.Node,
  hidden?: boolean,
|};

type TreeNestedNode = {|
  type: 'NESTED',
  children: Array<TreeNode>,
  label: React.Node,
  hidden?: boolean,
|};

type TreeProps = {|
  className?: string,
  itemClassName?: string,
  items: Array<TreeNode>,
  onSelect: (path: NodePath) => mixed,
  onConfirm: (path: NodePath) => mixed,
  onTripleClick: (path: NodePath) => mixed,
  selectedPaths: Array<NodePath>,
  collapsedPaths: Array<NodePath>,
  onCollapse: (path: NodePath) => mixed,
  onExpand: (path: NodePath) => mixed,
|};

type TreeState = {|
  focusedPath: ?NodePath,
  isFocused: boolean,
|};

export class Tree extends React.Component<TreeProps, TreeState> {
  _rootNode: ?HTMLOListElement;
  _subscriptions: UniversalDisposable;
  state = {
    isFocused: false,
    focusedPath: null,
  };

  componentDidMount() {
    const rootNode = nullthrows(this._rootNode);
    this._subscriptions = new UniversalDisposable(
      atom.commands.add(rootNode, {
        'core:move-up': this._selectPrev,
        'core:move-down': this._selectNext,
        'core:move-left': this._collapseNodeViaKeyboard,
        'core:move-right': this._expandNodeViaKeyboard,
        'core:confirm': () =>
          this.state.focusedPath && this._handleConfirm(this.state.focusedPath),
      }),
      Observable.merge(
        Observable.fromEvent(rootNode, 'focusin').mapTo(true),
        Observable.fromEvent(rootNode, 'focusout').mapTo(false),
      ).subscribe(isFocused => this.setState({isFocused})),
    );
  }

  componentWillUnmount() {
    this._subscriptions.dispose();
  }

  UNSAFE_componentWillReceiveProps() {
    this.setState((state, props) => ({
      focusedPath: props.selectedPaths[props.selectedPaths.length - 1],
    }));
  }

  _selectNext = () => {
    let nextNodePath;
    if (this.state.focusedPath == null) {
      nextNodePath = [0];
    } else {
      nextNodePath = getNextNodePath(
        this.props.items,
        this.state.focusedPath,
        this.props.collapsedPaths,
      );
    }
    if (nextNodePath != null) {
      this.props.onSelect(nextNodePath);
      this.setState({focusedPath: nextNodePath});
    }
  };

  _selectPrev = () => {
    let prevNodePath;
    if (this.state.focusedPath == null) {
      prevNodePath = [0];
    } else {
      prevNodePath = getPrevNodePath(
        this.props.items,
        this.state.focusedPath,
        this.props.collapsedPaths,
      );
    }
    if (prevNodePath != null) {
      this.props.onSelect(prevNodePath);
    }
  };

  _collapseNodeViaKeyboard = (e: atom$CustomEvent) => {
    if (this.state.focusedPath == null) {
      return;
    }

    let collapsablePath = [...this.state.focusedPath];
    let collapsableNode = selectNodeAtPath(this.props.items, collapsablePath);
    while (collapsableNode != null && collapsableNode.type !== 'NESTED') {
      collapsablePath = collapsablePath.slice(0, collapsablePath.length - 1);
      collapsableNode = selectNodeAtPath(this.props.items, collapsablePath);
    }

    if (collapsableNode == null) {
      return;
    }

    this.props.onCollapse(collapsablePath);
    // if a descendant of this node was selected when this node was collapsed,
    // moving selection to this node seems like intuitive behavior (see Chrome's
    // Elements tree)
    this.props.onSelect(collapsablePath);
  };

  _expandNodeViaKeyboard = (e: atom$CustomEvent) => {
    const {focusedPath} = this.state;
    if (focusedPath == null) {
      return;
    }

    const focusedNode = selectNodeAtPath(this.props.items, focusedPath);
    if (focusedNode != null && focusedNode.type === 'NESTED') {
      this.props.onExpand(focusedPath);
    }
  };

  _handleSelect = (path: NodePath) => {
    this.props.onSelect(path);
  };

  _handleConfirm = (path: NodePath) => {
    this.props.onConfirm(path);
  };

  render() {
    const {
      className,
      collapsedPaths,
      itemClassName,
      items: nodes,
      selectedPaths,
    } = this.props;
    const {focusedPath, isFocused} = this.state;

    return (
      <ol
        className={classnames(
          'list-tree',
          'nuclide-selectable-tree',
          'has-collapsable-children',
          className,
          {focused: isFocused},
        )}
        ref={node => (this._rootNode = node)}
        role="tree"
        style={{position: 'relative'}}
        tabIndex="0">
        {nodes.map((node, i) => (
          <AbstractTreeItem
            key={i}
            node={node}
            path={[i]}
            focusedPath={focusedPath}
            collapsedPaths={collapsedPaths}
            selectedPaths={selectedPaths}
            className={itemClassName}
            onSelect={this._handleSelect}
            onConfirm={this._handleConfirm}
            onTripleClick={this.props.onTripleClick}
            onCollapse={this.props.onCollapse}
            onExpand={this.props.onExpand}
          />
        ))}
      </ol>
    );
  }
}

function AbstractTreeItem({
  className,
  collapsedPaths,
  focusedPath,
  onConfirm,
  onSelect,
  onTripleClick,
  onCollapse,
  onExpand,
  node,
  path,
  selectedPaths,
}: {
  className: ?string,
  collapsedPaths: Array<NodePath>,
  focusedPath: ?NodePath,
  onConfirm: (path: NodePath) => mixed,
  onSelect: (path: NodePath) => mixed,
  onTripleClick: (path: NodePath) => mixed,
  onCollapse: (path: NodePath) => mixed,
  onExpand: (path: NodePath) => mixed,
  node: TreeNode,
  path: NodePath,
  selectedPaths: Array<NodePath>,
}): React.Node {
  if (node.hidden) {
    return null;
  }

  if (node.type === 'LEAF') {
    return (
      // $FlowIgnore
      <TreeItem
        className={className}
        isFocused={focusedPath && arrayEqual(focusedPath, path)}
        onConfirm={onConfirm}
        onSelect={onSelect}
        onTripleClick={onTripleClick}
        path={path}
        selectedPaths={selectedPaths}>
        {node.label}
      </TreeItem>
    );
  }

  const hasFlatChildren = node.children.every(child => child.type === 'LEAF');
  return (
    // $FlowIgnore
    <NestedTreeItem
      className={className}
      collapsed={false}
      hasFlatChildren={hasFlatChildren}
      focusedPath={focusedPath}
      onConfirm={onConfirm}
      onSelect={onSelect}
      onTripleClick={onTripleClick}
      onCollapse={onCollapse}
      onExpand={onExpand}
      path={path}
      collapsedPaths={collapsedPaths}
      selectedPaths={selectedPaths}
      label={node.label}>
      {node.children.map((child, i) => {
        const childPath = path.concat([i]);
        return (
          <AbstractTreeItem
            className={className}
            collapsedPaths={collapsedPaths}
            focusedPath={focusedPath}
            key={childPath.join('.')}
            node={child}
            onConfirm={onConfirm}
            onSelect={onSelect}
            onTripleClick={onTripleClick}
            onCollapse={onCollapse}
            onExpand={onExpand}
            path={childPath}
            selectedPaths={selectedPaths}
          />
        );
      })}
    </NestedTreeItem>
  );
}

type TreeItemProps = {|
  children?: React.Node,
  className?: ?string,
  isFocused: boolean,
  onSelect: (path: NodePath) => mixed,
  onConfirm: (path: NodePath) => mixed,
  onTripleClick: (path: NodePath) => mixed,
  path: NodePath,
  selectedPaths: Array<NodePath>,
|};

class TreeItem extends React.Component<TreeItemProps> {
  _liNode: ?HTMLLIElement;
  _handleClick = (e: SyntheticMouseEvent<>) => {
    const {onSelect, onConfirm, onTripleClick} = this.props;

    const numberOfClicks = e.detail;
    switch (numberOfClicks) {
      case 1:
        onSelect && onSelect(this.props.path);
        break;
      case 2:
        onConfirm && onConfirm(this.props.path);
        break;
      case 3:
        onTripleClick && onTripleClick(this.props.path);
        break;
      default:
        break;
    }
  };

  scrollIntoView() {
    if (this._liNode != null) {
      scrollIntoView(this._liNode);
    }
  }

  render() {
    const {className, isFocused, path, selectedPaths, children} = this.props;
    const isSelected = selectedPaths.some(selectedPath =>
      shallowEqual(path, selectedPath),
    );
    if (isSelected) {
      process.nextTick(() => {
        // We *are* using `scrollIntoView()` instead of the raw DOM API
        // eslint-disable-next-line nuclide-internal/dom-apis
        this.scrollIntoView();
      });
    }
    return (
      <li
        aria-activedescendant={isFocused}
        aria-selected={isSelected}
        className={classnames('list-item', className, {
          selected: isSelected,
        })}
        onClick={this._handleClick}
        ref={liNode => (this._liNode = liNode)}
        role="treeitem">
        {isSelected && typeof children === 'string' ? (
          // String children must be wrapped to receive correct styles when selected.
          <span>{children}</span>
        ) : (
          children
        )}
      </li>
    );
  }
}

type NestedTreeItemProps = {
  label?: React.Node,
  children?: React.Node,
  className?: ?string,
  hasFlatChildren?: boolean, // passthrough to inner TreeList
  focusedPath: NodePath,
  onSelect: (path: NodePath) => mixed,
  onConfirm: (path: NodePath) => mixed,
  onTripleClick: (path: NodePath) => mixed,
  onCollapse: (path: NodePath) => mixed,
  onExpand: (path: NodePath) => mixed,
  path: NodePath,
  selectedPaths: Array<NodePath>,
  collapsedPaths: Array<NodePath>,
};

class NestedTreeItem extends React.Component<NestedTreeItemProps> {
  _itemNode: ?HTMLDivElement;
  _subscriptions: UniversalDisposable;

  _handleClick = (e: SyntheticMouseEvent<>) => {
    const itemNode = this._itemNode;
    if (itemNode == null) {
      return;
    }

    invariant(e.target instanceof Element);
    if (e.target.closest('.list-item') !== itemNode) {
      // this was a click on a descendant node in the inner list
      return;
    }

    // TODO: This is gross. It assumes that the expand chevron is present in the
    // `before` pseudoelement (as is with most themes), and measures the space
    // it occupies using computed style properties, not actual measurements.
    // The toggle chevron should be reimplemented as a true dom node instead,
    // bypassing themes. Though this is more visually consistent, it's probably
    // not worth the hassle.
    const beforeStyle = window.getComputedStyle(this._itemNode, ':before');
    const itemStyle = window.getComputedStyle(this._itemNode);
    const chevronWidth =
      parsePx(itemStyle.paddingLeft) +
      parsePx(beforeStyle.paddingLeft) +
      parsePx(beforeStyle.paddingRight) +
      parsePx(beforeStyle.marginLeft) +
      parsePx(beforeStyle.marginRight) +
      parsePx(beforeStyle.width) +
      parsePx(beforeStyle.left);

    const {path, collapsedPaths} = this.props;
    invariant(e.nativeEvent instanceof MouseEvent);
    if (e.nativeEvent.offsetX <= chevronWidth) {
      if (
        collapsedPaths.some(collapsedPath => arrayEqual(path, collapsedPath))
      ) {
        this.props.onExpand(path);
      } else {
        this.props.onCollapse(path);
      }
      return;
    }

    const {onSelect, onConfirm, onTripleClick} = this.props;
    const numberOfClicks = e.detail;
    if (numberOfClicks === 1 && onSelect != null) {
      onSelect(path);
    } else if (numberOfClicks === 2 && onConfirm != null) {
      onConfirm(path);
    } else if (numberOfClicks === 3 && onTripleClick != null) {
      onTripleClick(path);
    }
  };

  render() {
    const {
      className,
      hasFlatChildren,
      focusedPath,
      selectedPaths,
      collapsedPaths,
      path,
      label,
      children,
    } = this.props;
    const isFocused = focusedPath && arrayEqual(path, focusedPath);
    const isSelected = selectedPaths.some(selectedPath =>
      shallowEqual(path, selectedPath),
    );
    const isCollapsed = collapsedPaths.some(collapsedPath =>
      shallowEqual(path, collapsedPath),
    );

    return (
      <li
        aria-activedescendant={isFocused}
        aria-selected={isSelected}
        aria-expanded={!isCollapsed}
        className={classnames('list-nested-item', className, {
          collapsed: isCollapsed,
          selected: isSelected,
        })}
        onClick={this._handleClick}
        role="treeitem">
        {label == null ? null : (
          <div className="list-item" ref={node => (this._itemNode = node)}>
            {label}
          </div>
        )}
        <TreeList hasFlatChildren={hasFlatChildren}>{children}</TreeList>
      </li>
    );
  }
}

function selectNodeAtPath(roots: Array<TreeNode>, path: NodePath): ?TreeNode {
  if (path.length === 0) {
    return;
  }

  let node = roots[path[0]];
  for (let i = 1; i < path.length; i++) {
    invariant(node.type === 'NESTED');
    node = node.children[path[i]];
  }
  return node;
}

function getNextNodePath(
  roots: Array<TreeNode>,
  path: NodePath,
  collapsedPaths: Array<NodePath>,
): ?NodePath {
  if (path.length === 0) {
    return null;
  }

  const currentNode = selectNodeAtPath(roots, path);
  if (currentNode == null) {
    return;
  }

  if (
    currentNode.type === 'NESTED' &&
    currentNode.children.length > 0 &&
    // don't traverse children of collapsed nodes
    !collapsedPaths.find(collapsedPath => arrayEqual(collapsedPath, path))
  ) {
    // 'down' was pressed on a nested item. most of the time we want go to its
    // first child, but we need to make sure it's not hidden (eg filtered by
    // a search) first
    const firstVisibleChildIndex = currentNode.children.findIndex(
      n => !n.hidden,
    );
    if (firstVisibleChildIndex >= 0) {
      return path.concat([firstVisibleChildIndex]);
    }
  }

  return findNextSibling(roots, path, collapsedPaths);
}

function findNextSibling(
  roots: Array<TreeNode>,
  path: NodePath,
  collapsedPaths: Array<NodePath>,
): ?NodePath {
  if (path.length === 0) {
    return null;
  }

  const leadingIndexes = path.slice(0, path.length - 1);
  const tailIndex = path[path.length - 1];
  const nextSiblingPath = [...leadingIndexes, tailIndex + 1];
  const nextSibling = selectNodeAtPath(roots, nextSiblingPath);
  if (nextSibling != null) {
    if (nextSibling.hidden) {
      // skip over next hidden nodes by finding *their* next sibling
      return findNextSibling(roots, nextSiblingPath, collapsedPaths);
    }
    return nextSiblingPath;
  }

  // there's no next sibling. let's navigate to this node's parent's siblings
  return findNextSibling(roots, leadingIndexes, collapsedPaths);
}

function getPrevNodePath(
  roots: Array<TreeNode>,
  path: NodePath,
  collapsedPaths: Array<NodePath>,
): ?NodePath {
  if (path.length === 0) {
    return null;
  }

  const leadingIndexes = path.slice(0, path.length - 1);
  const tailIndex = path[path.length - 1];
  const prevSiblingPath = [...leadingIndexes, tailIndex - 1];
  const prevSibling = selectNodeAtPath(roots, prevSiblingPath);
  if (prevSibling != null) {
    if (prevSibling.hidden) {
      return getPrevNodePath(roots, prevSiblingPath, collapsedPaths);
    }

    if (
      prevSibling.type === 'NESTED' &&
      prevSibling.children.length > 0 &&
      // don't traverse children of collapsed nodes
      !collapsedPaths.find(collapsedPath =>
        arrayEqual(collapsedPath, prevSiblingPath),
      )
    ) {
      // pressed 'up' on a node just after an expanded nested item. Normally this
      // should take us to the last item inside the expanded node, but some may
      // be hidden. Find the last in the list that's visible.
      const lastVisibleChildIndex = arrayFindLastIndex(
        prevSibling.children,
        n => !n.hidden,
      );
      if (lastVisibleChildIndex >= 0) {
        return prevSiblingPath.concat([lastVisibleChildIndex]);
      }
    }

    return prevSiblingPath;
  }

  // return the parent if it's a valid path
  if (leadingIndexes.length > 0) {
    return leadingIndexes;
  }
}

function parsePx(px: string): number {
  return px.length === 0 ? 0 : Number(px.replace('px', ''));
}
