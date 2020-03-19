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

import * as React from 'react';
import classnames from 'classnames';
import invariant from 'assert';
import {scrollIntoView} from './scrollIntoView';

export function Tree({className, style, ...props}: Object) {
  return (
    <ol
      className={classnames('list-tree', className)}
      role="tree"
      style={{position: 'relative', ...style}}
      {...props}
    />
  );
}

type TreeItemProps = {|
  children?: React.Node,
  className?: string,
  // handled below in `handleClick`
  /* eslint-disable react/no-unused-prop-types */
  onSelect?: (e: SyntheticMouseEvent<>) => mixed,
  onConfirm?: (e: SyntheticMouseEvent<>) => mixed,
  onTripleClick?: (e: SyntheticMouseEvent<>) => mixed,
  /* eslint-enable react/no-unused-prop-types */
  selected?: boolean,
  onMouseDown?: (e: SyntheticMouseEvent<>) => mixed,
  onMouseEnter?: (e: SyntheticMouseEvent<>) => mixed,
  onMouseLeave?: (e: SyntheticMouseEvent<>) => mixed,
  path?: string,
  name?: string,
  title?: string,
|};

export class TreeItem extends React.Component<TreeItemProps> {
  _liNode: ?HTMLLIElement;
  _handleClick = handleClick.bind(this);

  scrollIntoView() {
    if (this._liNode != null) {
      scrollIntoView(this._liNode);
    }
  }

  render() {
    const {
      className,
      selected,
      children,
      onMouseDown,
      onMouseEnter,
      onMouseLeave,
      path,
      name,
      title,
    } = this.props;

    return (
      <div title={title}>
        <li
          aria-selected={selected}
          className={classnames(
            className,
            {
              selected,
            },
            'list-item',
          )}
          onMouseDown={onMouseDown}
          onMouseEnter={onMouseEnter}
          onMouseLeave={onMouseLeave}
          data-path={path}
          data-name={name}
          onClick={this._handleClick}
          ref={liNode => (this._liNode = liNode)}
          role="treeitem"
          tabIndex={selected ? '0' : '-1'}>
          {selected && typeof children === 'string' ? (
            // String children must be wrapped to receive correct styles when selected.
            <span>{children}</span>
          ) : (
            children
          )}
        </li>
      </div>
    );
  }
}

type NestedTreeItemProps = {|
  title?: React.Node,
  children?: mixed,
  className?: string,
  hasFlatChildren?: boolean, // passthrough to inner TreeList
  selected?: boolean,
  collapsed?: boolean,
  // handled below in `handleClick`
  /* eslint-disable react/no-unused-prop-types */
  onSelect?: (e: SyntheticMouseEvent<>) => mixed,
  onConfirm?: (e: SyntheticMouseEvent<>) => mixed,
  onTripleClick?: (e: SyntheticMouseEvent<>) => mixed,
  /* eslint-disable react/no-unused-prop-types */
|};

export class NestedTreeItem extends React.Component<NestedTreeItemProps> {
  _itemNode: ?HTMLDivElement;
  _handleClick = (e: SyntheticMouseEvent<>) => {
    const itemNode = this._itemNode;
    if (itemNode == null) {
      return;
    }

    invariant(e.target instanceof Element);
    if (e.target.closest('.list-item') === itemNode) {
      handleClick.call(this, e);
    }
  };

  render() {
    const {
      className,
      hasFlatChildren,
      selected,
      collapsed,
      title,
      children,
    } = this.props;

    return (
      <li
        aria-selected={selected}
        aria-expanded={!collapsed}
        className={classnames(
          className,
          {
            selected,
            collapsed,
          },
          'list-nested-item',
        )}
        onClick={this._handleClick}
        role="treeitem"
        tabIndex={selected ? '0' : '-1'}>
        {title == null ? null : (
          <div
            tabIndex={-1}
            className="native-key-bindings list-item"
            ref={node => (this._itemNode = node)}>
            {title}
          </div>
        )}
        <TreeList hasFlatChildren={hasFlatChildren}>{children}</TreeList>
      </li>
    );
  }
}

type TreeListProps = {
  className?: string,
  /* typically, instances of TreeItem or NestedTreeItem. */
  children?: mixed,
  showArrows?: boolean,
  hasFlatChildren?: boolean,
};
export const TreeList = (props: TreeListProps) => (
  // $FlowFixMe(>=0.53.0) Flow suppress
  <ul
    className={classnames(
      props.className,
      {
        'has-collapsable-children': props.showArrows,
        'has-flat-children': props.hasFlatChildren,
      },
      'list-tree',
    )}
    role="group">
    {props.children}
  </ul>
);

function handleClick(e: SyntheticMouseEvent<>): void {
  const {onSelect, onConfirm, onTripleClick} = this.props;

  const numberOfClicks = e.detail;
  switch (numberOfClicks) {
    case 1:
      onSelect && onSelect(e);
      break;
    case 2:
      onConfirm && onConfirm(e);
      break;
    case 3:
      onTripleClick && onTripleClick(e);
      break;
    default:
      break;
  }
}
