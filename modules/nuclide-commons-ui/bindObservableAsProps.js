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

import type {Observable} from 'rxjs';

import React from 'react';

/**
 * Injects any key/value pairs from the given Observable value into the component as named props.
 * e.g. `bindObservableAsProps(Observable.just({val: 42}), FooComponent)` will translate to
 * `<FooComponent val={42} />`.
 *
 * The resulting component re-renders on updates to the observable.
 * The wrapped component is guaranteed to render only if the observable has resolved;
 * otherwise, the wrapper component renders `null`.
 */
export function bindObservableAsProps<T: ReactClass<any>, U: T>(
  stream: Observable<{+[key: string]: any}>,
  ComposedComponent: T,
): U {
  // $FlowIssue The return type is guaranteed to be the same as the type of ComposedComponent.
  return class extends React.Component {
    _subscription: ?rxjs$ISubscription;
    state: {[key: string]: any};
    _resolved: boolean;
    _wrappedComponent: ?T;

    constructor(props) {
      super(props);
      this._subscription = null;
      this.state = {};
      this._resolved = false;
    }

    getWrappedComponent(): ?T {
      return this._wrappedComponent;
    }

    componentDidMount(): void {
      this._subscription = stream.subscribe(newState => {
        this._resolved = true;
        this.setState(newState);
      });
    }

    componentWillUnmount(): void {
      if (this._subscription != null) {
        this._subscription.unsubscribe();
      }
    }

    render(): ?React.Element<any> {
      if (!this._resolved) {
        return null;
      }
      const props = {
        ...this.props,
        ...this.state,
      };
      return (
        <ComposedComponent
          ref={component => (this._wrappedComponent = component)}
          {...props}
        />
      );
    }
  };
}
