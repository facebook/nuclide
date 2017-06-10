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

import invariant from 'assert';
import classnames from 'classnames';
import React from 'react';

type Props = {
  progress: ?number,
  visible: boolean,
};

export class ProgressBar extends React.Component {
  props: Props;

  render(): ?React.Element<any> {
    const className = classnames('nuclide-task-runner-progress-bar', {
      indeterminate: this._isIndeterminate(),
    });
    return (
      <div className={className} hidden={!this.props.visible}>
        {this._renderBar()}
      </div>
    );
  }

  _isIndeterminate(): boolean {
    return this.props.progress == null;
  }

  _renderBar(): ?React.Element<any> {
    if (this._isIndeterminate()) {
      return null;
    }

    invariant(this.props.progress != null);
    return <Bar progress={this.props.progress} />;
  }
}

type BarProps = {
  progress: number,
};

class Bar extends React.Component {
  props: BarProps;

  render(): React.Element<any> {
    const pct = Math.max(0, Math.min(100, this.props.progress * 100));
    return (
      <div
        className="nuclide-task-runner-progress-bar-bar"
        style={{width: `${pct}%`}}
      />
    );
  }
}
