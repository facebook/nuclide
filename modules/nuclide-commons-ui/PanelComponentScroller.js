/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import classnames from 'classnames';
import * as React from 'react';

type Props = {
  children?: mixed,
  className?: string,
  flexDirection?: 'column',
  overflowX?: string,
  onScroll?: (event: Event) => void,
  onFocus?: (event: SyntheticEvent<>) => void,
};

export class PanelComponentScroller extends React.Component<Props> {
  render(): React.Node {
    const style =
      this.props.overflowX == null ? null : {overflowX: this.props.overflowX};
    const className = classnames(
      this.props.className,
      'nuclide-ui-panel-component-scroller',
      'nuclide-scrollbar-style-fix',
      {
        'nuclide-ui-panel-component-scroller--column':
          this.props.flexDirection === 'column',
      },
    );

    return (
      // $FlowFixMe(>=0.53.0) Flow suppress
      <div
        className={className}
        style={style}
        onScroll={this.props.onScroll}
        onFocus={this.props.onFocus}>
        {this.props.children}
      </div>
    );
  }
}
