/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import addTooltip from './addTooltip';
import classnames from 'classnames';
import * as React from 'react';

export type LoadingSpinnerSize = 'EXTRA_SMALL' | 'SMALL' | 'MEDIUM' | 'LARGE';
type Props = {
  className?: string,
  /** The size of the LoadingSpinner. Defaults to MEDIUM. */
  size?: LoadingSpinnerSize,
  /**
   * An optional delay (in milliseconds) between mounting the component and actually rendering
   * the spinner to avoid UI churn.
   */
  delay?: number,
  tooltip?: atom$TooltipsAddOptions,
};

export const LoadingSpinnerSizes = Object.freeze({
  EXTRA_SMALL: 'EXTRA_SMALL',
  SMALL: 'SMALL',
  MEDIUM: 'MEDIUM',
  LARGE: 'LARGE',
});

const LoadingSpinnerClassnames = Object.freeze({
  EXTRA_SMALL: 'loading-spinner-tiny',
  SMALL: 'loading-spinner-small',
  MEDIUM: 'loading-spinner-medium',
  LARGE: 'loading-spinner-large',
});

/**
 * Shows an indefinite, animated LoadingSpinner.
 */
export class LoadingSpinner extends React.Component<
  Props,
  {shouldRender: boolean},
> {
  _timeout: ?TimeoutID;

  constructor(props: Props) {
    super(props);
    this.state = {shouldRender: !this.props.delay};
  }

  componentDidMount(): void {
    if (!this.state.shouldRender) {
      this._timeout = setTimeout(
        () => this.setState({shouldRender: true}),
        this.props.delay,
      );
    }
  }

  componentWillUnmount(): void {
    if (this._timeout != null) {
      clearTimeout(this._timeout);
    }
  }

  render(): React.Node {
    const {className, size, tooltip} = this.props;
    if (!this.state.shouldRender) {
      return null;
    }

    const ref = tooltip ? addTooltip(tooltip) : null;
    const safeSize =
      size != null && LoadingSpinnerSizes.hasOwnProperty(size)
        ? size
        : LoadingSpinnerSizes.MEDIUM;
    const sizeClassname = LoadingSpinnerClassnames[safeSize];
    const newClassName = classnames(className, 'loading', sizeClassname);
    return (
      <div
        className={newClassName}
        // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
        ref={ref}
      />
    );
  }
}
