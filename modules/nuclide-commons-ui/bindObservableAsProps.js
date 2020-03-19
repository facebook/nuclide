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

import * as React from 'react';
import getDisplayName from 'nuclide-commons/getDisplayName';

/**
 * Injects any key/value pairs from the given Observable value into the component as named props.
 * e.g. `bindObservableAsProps(Observable.just({val: 42}), FooComponent)` will translate to
 * `<FooComponent val={42} />`.
 *
 * The resulting component re-renders on updates to the observable.
 * The wrapped component is guaranteed to render only if the observable has resolved;
 * otherwise, the wrapper component renders `null`.
 */
export function bindObservableAsProps<T: React.ComponentType<any>, U: T>(
  stream: Observable<{+[key: string]: any}>,
  ComposedComponent: T,
): U {
  // $FlowIssue The return type is guaranteed to be the same as the type of ComposedComponent.
  return class extends React.Component<$FlowFixMeProps, {[key: string]: any}> {
    static displayName = `bindObservableAsProps(${getDisplayName(
      ComposedComponent,
    )})`;

    _subscription: ?rxjs$ISubscription;
    _resolved: boolean;

    constructor(props) {
      super(props);
      this._subscription = null;
      this.state = {};
      this._resolved = false;
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

    render(): React.Node {
      if (!this._resolved) {
        return null;
      }
      const props = {
        ...this.props,
        ...this.state,
      };
      return <ComposedComponent {...props} />;
    }
  };
}
