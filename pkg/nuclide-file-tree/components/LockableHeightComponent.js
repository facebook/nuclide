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

type State = {
  lockedHeight: ?number,
};
type Props = {
  isLocked: boolean,
  children: any,
};

export class LockableHeight extends React.Component {
  props: Props;
  state: State;
  _root: HTMLElement;

  constructor(props: Props) {
    super(props);
    this.state = {
      lockedHeight: null,
    };
  }

  componentDidMount() {
    if (this.props.isLocked) {
      this.setState({lockedHeight: 0});
    }
  }

  componentWillReceiveProps(nextProps: Props) {
    if (this.props.isLocked !== nextProps.isLocked) {
      const lockedHeight = nextProps.isLocked ? this._currentHeight() : null;
      this.setState({lockedHeight});
    }
  }

  _currentHeight() {
    const computedStyle = window.getComputedStyle(this._root);
    return computedStyle.height;
  }

  render(): React.Element<any> {
    let style = {};
    let className = null;
    if (this.props.isLocked) {
      const {lockedHeight} = this.state;
      // Flexbox supercedes the height attributes, so we use min/max heigh.
      style = {maxHeight: lockedHeight, minHeight: lockedHeight};
      className = 'nuclide-file-tree-locked-height';
    }
    return (
      <div
        style={style}
        className={className}
        ref={node => {
          this._root = node;
        }}>
        {this.props.children}
      </div>
    );
  }
}
