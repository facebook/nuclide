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

import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import * as React from 'react';

export type Props = {|
  name: string,
  start: () => void,
  cancel: () => void,
  progress: ?number,
  isRunning: boolean,
|};

export class TaskButton extends React.Component<Props> {
  _getLabel(): string | React.Element<any> {
    if (!this.props.isRunning) {
      return this.props.name;
    }
    const progress =
      this.props.progress != null
        ? `${this.props.progress.toFixed(2)}%`
        : 'running';
    return (
      <i>
        {this.props.name} ({progress}). Click to cancel
      </i>
    );
  }

  render(): React.Node {
    return (
      <Button
        size={ButtonSizes.SMALL}
        onClick={this.props.isRunning ? this.props.cancel : this.props.start}>
        {this._getLabel()}
      </Button>
    );
  }
}
