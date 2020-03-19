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

import {Button} from 'nuclide-commons-ui/Button';
import * as React from 'react';

type Props = {|
  +dispatch: (action: Object) => mixed, // TODO: Actually type action
  count: number,
|};

export default class WidgetComponent extends React.Component<Props> {
  render(): React.Node {
    return (
      <div>
        This is the widget! Count is {this.props.count}
        <br />
        <Button onClick={this._increment}>Increment</Button>
        <Button onClick={this._decrement}>Decrement</Button>
      </div>
    );
  }

  _increment = () => {
    this.props.dispatch({type: 'increment'});
  };

  _decrement = () => {
    this.props.dispatch({type: 'decrement'});
  };
}
