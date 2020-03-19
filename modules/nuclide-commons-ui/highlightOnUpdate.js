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

import * as React from 'react';
import shallowequal from 'shallowequal';

/**
 * Wraps DecoratedComponent in a special `span` with a configurable classname whenever the
 * component's props change.
 */
export function highlightOnUpdate<
  T: React.ComponentType<any>,
  P: {+[key: string]: mixed},
>(
  ComposedComponent: T,
  /**
   * The result of this function determines whether to apply the highlight or not.
   */
  arePropsEqual?: (p1: P, p2: P) => boolean = shallowequal,
  /**
   * className used in the wrapper. You can style both `className` and `<className>-highlight`.
   */
  className?: string = 'nuclide-ui-highlight-on-render',
  /**
   * Delay in ms until the `*-highlight` className gets removed from the wrapper.
   * Effectively throttles the frequency of highlight pulses.
   */
  unhighlightDelay?: number = 200,
): T {
  // $FlowIssue The return type is guaranteed to be the same as the type of ComposedComponent.
  return class extends React.Component<P, void> {
    showFlash: boolean;
    timeout: ?TimeoutID;

    constructor(props: P) {
      super(props);
      this.showFlash = false;
    }

    UNSAFE_componentWillUpdate(nextProps: P, nextState: void): void {
      if (arePropsEqual(nextProps, this.props)) {
        // Skip if prop values didn't actually change.
        return;
      }
      if (this.timeout != null || this.showFlash) {
        // Skip if already scheduled.
        return;
      }
      this.showFlash = true;
      this.timeout = setTimeout(() => {
        this.showFlash = false;
        this.timeout = null;
        this.forceUpdate();
      }, unhighlightDelay);
    }

    render(): React.Node {
      return (
        <span
          className={`${className} ${
            this.showFlash ? className + '-highlight' : ''
          }`}>
          <ComposedComponent {...this.props} />
        </span>
      );
    }
  };
}
