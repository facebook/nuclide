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

import type {Observable} from 'rxjs';

import React from 'react';
import invariant from 'assert';

// State is set to null indicates that the observable has not
// produced a value yet.
export type State<T> = {
  data: ?T,
};

export type Props<T> = {
  data: Observable<?T>,
};

// Derived classes must override render()
// Also might want to override shouldComponentUpdate(nextProps, nextState).
export class ObservingComponent<T> extends React.Component<
  void,
  Props<T>,
  State<T>,
> {
  state: State<T>;
  props: Props<T>;

  subscription: ?rxjs$ISubscription;

  constructor(props: Props<T>) {
    super(props);
    this.state = {
      data: null,
    };
  }

  componentWillMount(): void {
    this._subscribe(this.props);
  }

  componentWillReceiveProps(newProps: Props<T>): void {
    if (newProps.data === this.props.data) {
      return;
    }

    this._unsubscribe();
    this._subscribe(newProps);
  }

  _subscribe(newProps: Props<T>): void {
    invariant(this.subscription == null);
    this.subscription = this.props.data.subscribe(data => {
      this.setState({data});
    });
    this.setState({data: null});
  }

  _unsubscribe(): void {
    invariant(this.subscription != null);
    this.subscription.unsubscribe();
    this.subscription = null;
  }

  componentWillUnmount(): void {
    this._unsubscribe();
  }
}
