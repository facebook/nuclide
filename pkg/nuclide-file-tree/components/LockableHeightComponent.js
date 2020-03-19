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

import * as React from 'react';
import nullthrows from 'nullthrows';

type Props = {|
  isLocked: boolean,
  children: any,
|};

type State = {|
  lockedHeight: ?number,
|};

export class LockableHeight extends React.Component<Props, State> {
  _root: ReactHTMLElementRef<HTMLDivElement> = React.createRef();

  state = {
    lockedHeight: null,
  };

  componentDidMount() {
    if (this.props.isLocked) {
      this.setState({lockedHeight: 0});
    }
  }

  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.props.isLocked !== nextProps.isLocked) {
      this.setState({
        lockedHeight: nextProps.isLocked
          ? nullthrows(this._root.current).clientHeight
          : null,
      });
    }
  }

  render(): React.Node {
    let style = {};
    let className = null;
    if (this.props.isLocked) {
      const {lockedHeight} = this.state;
      // Flexbox supercedes the height attributes, so we use min/max height.
      style = {maxHeight: lockedHeight, minHeight: lockedHeight};
      className = 'nuclide-file-tree-locked-height';
    }
    return (
      <div style={style} className={className} ref={this._root}>
        {this.props.children}
      </div>
    );
  }
}
