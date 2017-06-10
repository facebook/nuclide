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

type TreeItemProps = {
  children?: mixed,
  className?: string,
  selected?: boolean,
};
export const TreeItem = (props: TreeItemProps) => {
  const {className, selected, children, ...remainingProps} = props;
  return (
    <li
      className={classnames(
        className,
        {
          selected,
        },
        'list-item',
      )}
      {...remainingProps}>
      {selected && typeof children === 'string'
        ? // String children must be wrapped to receive correct styles when selected.
          <span>{children}</span>
        : children}
    </li>
  );
};

type NestedTreeItemProps = {
  title: ?React.Element<any>,
  children?: mixed,
  className?: string,
  selected?: boolean,
  collapsed?: boolean,
};
export const NestedTreeItem = (props: NestedTreeItemProps) => {
  const {
    className,
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
      <div className="list-item">
        {title}
      </div>
      <TreeList>
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
};
export const TreeList = (props: TreeListProps) => (
  <ul
    className={classnames(
      props.className,
      {
        'has-collapsable-children': props.showArrows,
      },
      'list-tree',
    )}>
    {props.children}
  </ul>
);
