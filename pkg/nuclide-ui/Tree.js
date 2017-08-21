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

import React from 'react';
import classnames from 'classnames';
import {scrollIntoView} from 'nuclide-commons-ui/scrollIntoView';

type TreeItemProps = {
  children?: mixed,
  className?: string,
  selected?: boolean,
};

export class TreeItem extends React.Component {
  props: TreeItemProps;
  _liNode: ?Element;

  scrollIntoView() {
    if (this._liNode != null) {
      scrollIntoView(this._liNode);
    }
  }

  render() {
    const {className, selected, children, ...remainingProps} = this.props;
    return (
      <li
        className={classnames(
          className,
          {
            selected,
          },
          'list-item',
        )}
        {...remainingProps}
        ref={liNode => (this._liNode = liNode)}>
        {selected && typeof children === 'string'
          ? // String children must be wrapped to receive correct styles when selected.
            <span>
              {children}
            </span>
          : children}
      </li>
    );
  }
}

type NestedTreeItemProps = {
  title?: ?React.Element<any>,
  children?: mixed,
  className?: string,
  hasFlatChildren?: boolean, // passthrough to inner TreeList
  selected?: boolean,
  collapsed?: boolean,
};
export const NestedTreeItem = (props: NestedTreeItemProps) => {
  const {
    className,
    hasFlatChildren,
    selected,
    collapsed,
    title,
    children,
    ...remainingProps
  } = props;
  return (
    <li
      className={classnames(
        className,
        {
          selected,
          collapsed,
        },
        'list-nested-item',
      )}
      {...remainingProps}>
      {title
        ? <div className="list-item">
            {title}
          </div>
        : null}
      <TreeList hasFlatChildren={hasFlatChildren}>
        {children}
      </TreeList>
    </li>
  );
};

type TreeListProps = {
  className?: string,
  /* typically, instances of TreeItem or NestedTreeItem. */
  children?: mixed,
  showArrows?: boolean,
  hasFlatChildren?: boolean,
};
export const TreeList = (props: TreeListProps) =>
  <ul
    className={classnames(
      props.className,
      {
        'has-collapsable-children': props.showArrows,
        'has-flat-children': props.hasFlatChildren,
      },
      'list-tree',
    )}>
    {props.children}
  </ul>;
