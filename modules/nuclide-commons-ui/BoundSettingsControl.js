/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import SettingsControl from './SettingsControl';
import * as React from 'react';

type Props = {|
  keyPath: string,
|};

type State = {|
  value: any,
|};

export default class BoundSettingsControl extends React.Component<
  Props,
  State,
> {
  _observeConfigDisposable: ?IDisposable;

  constructor(props: Props) {
    super(props);
    this.state = {
      value: atom.config.get(props.keyPath),
    };
  }

  _updateSubscription(): void {
    if (this._observeConfigDisposable != null) {
      this._observeConfigDisposable.dispose();
    }
    this._observeConfigDisposable = atom.config.onDidChange(
      this.props.keyPath,
      ({newValue}) => {
        this.setState({value: newValue});
      },
    );
  }

  componentDidMount(): void {
    this._updateSubscription();
  }

  componentDidUpdate(prevProps: Props): void {
    if (prevProps.keyPath !== this.props.keyPath) {
      this.setState({value: atom.config.get(this.props.keyPath)});
      this._updateSubscription();
    }
  }

  componentWillUnmount(): void {
    if (this._observeConfigDisposable != null) {
      this._observeConfigDisposable.dispose();
    }
  }

  render(): React.Element<any> {
    const schema = atom.config.getSchema(this.props.keyPath);
    return (
      <SettingsControl
        keyPath={this.props.keyPath}
        value={this.state.value}
        onChange={this._onChange}
        schema={schema}
      />
    );
  }

  _onChange = (value: any): void => {
    atom.config.set(this.props.keyPath, value);
  };
}
