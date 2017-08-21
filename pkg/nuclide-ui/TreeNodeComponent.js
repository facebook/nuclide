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

import type {LazyTreeNode} from './LazyTreeNode';

import React from 'react';
import ReactDOM from 'react-dom';
import classnames from 'classnames';

const INDENT_IN_PX = 10;
const INDENT_PER_LEVEL_IN_PX = 15;
const DOWN_ARROW = '\uF0A3';
const RIGHT_ARROW = '\uF078';
const SPINNER = '\uF087';

type Props = {
  depth: number,
  isContainer: boolean,
  isExpanded: boolean,
  isLoading: boolean,
  isSelected: boolean,
  label: string,
  labelElement?: ?React.Element<any>,
  labelClassName: string,
  node: LazyTreeNode,
  onClickArrow: (event: SyntheticMouseEvent, node: LazyTreeNode) => void,
  onClick: (event: SyntheticMouseEvent, node: LazyTreeNode) => void,
  onDoubleClick: (event: SyntheticMouseEvent, node: LazyTreeNode) => void,
  onMouseDown: (event: SyntheticMouseEvent, node: LazyTreeNode) => void,
  path: string,
  rowClassName: string,
};

/**
 * Represents one entry in a TreeComponent.
 */
export class TreeNodeComponent extends React.PureComponent {
  props: Props;
  state: void;

  render(): React.Element<any> {
    const rowClassNameObj: {[key: string]: ?boolean} = {
      // Support for selectors in the "file-icons" package.
      // @see {@link https://atom.io/packages/file-icons|file-icons}
      'entry file list-item': true,
      'nuclide-tree-component-item': true,
      'nuclide-tree-component-selected': this.props.isSelected,
    };
    if (this.props.rowClassName) {
      rowClassNameObj[this.props.rowClassName] = true;
    }

    const itemStyle = {
      paddingLeft: INDENT_IN_PX + this.props.depth * INDENT_PER_LEVEL_IN_PX,
    };

    let arrow;
    if (this.props.isContainer) {
      if (this.props.isExpanded) {
        if (this.props.isLoading) {
          arrow = (
            <span className="nuclide-tree-component-item-arrow-spinner">
              {SPINNER}
            </span>
          );
        } else {
          arrow = DOWN_ARROW;
        }
      } else {
        arrow = RIGHT_ARROW;
      }
    }

    return (
      <div
        className={classnames(rowClassNameObj)}
        style={itemStyle}
        onClick={this._onClick}
        onDoubleClick={this._onDoubleClick}
        onMouseDown={this._onMouseDown}>
        <span className="nuclide-tree-component-item-arrow" ref="arrow">
          {arrow}
        </span>
        {this.props.labelElement != null
          ? this.props.labelElement
          : <span
              className={this.props.labelClassName}
              // `data-name` is support for selectors in the "file-icons" package.
              // @see {@link https://atom.io/packages/file-icons|file-icons}
              data-name={this.props.label}
              data-path={this.props.path}>
              {this.props.label}
            </span>}
      </div>
    );
  }

  _onClick = (event: SyntheticMouseEvent): void => {
    // $FlowFixMe
    if (ReactDOM.findDOMNode(this.refs.arrow).contains(event.target)) {
      this.props.onClickArrow(event, this.props.node);
    } else {
      this.props.onClick(event, this.props.node);
    }
  };

  _onDoubleClick = (event: SyntheticMouseEvent): void => {
    this.props.onDoubleClick(event, this.props.node);
  };

  _onMouseDown = (event: SyntheticMouseEvent): void => {
    this.props.onMouseDown(event, this.props.node);
  };
}
