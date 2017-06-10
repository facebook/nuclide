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

import classnames from 'classnames';
import React from 'react';

type Props = {
  children?: mixed,
  flexDirection?: 'column',
  overflowX?: string,
  onScroll?: (event: Event) => void,
  onFocus?: (event: SyntheticEvent) => void,
};

export class PanelComponentScroller extends React.Component {
  props: Props;

  render(): React.Element<any> {
    const style = this.props.overflowX == null
      ? null
      : {overflowX: this.props.overflowX};
    const className = classnames('nuclide-ui-panel-component-scroller', {
      'nuclide-ui-panel-component-scroller--column': this.props
        .flexDirection === 'column',
    });

    return (
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
