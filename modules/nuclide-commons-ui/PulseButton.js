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

import * as React from 'react';
import classnames from 'classnames';

type Props = {
  ariaLabel: string,
  className?: string,
  isSelected?: boolean,
  onClick?: (SyntheticMouseEvent<>) => mixed,
  size?: number,
  style?: {[key: string]: string},
  onMouseOver?: (SyntheticMouseEvent<>) => mixed,
  onMouseLeave?: (SyntheticMouseEvent<>) => mixed,
};

export default class PulseButton extends React.Component<Props> {
  render() {
    const {
      ariaLabel,
      className,
      isSelected,
      size = 10,
      style,
      onClick,
      onMouseOver,
      onMouseLeave,
    } = this.props;

    return (
      <a
        className={classnames(
          {
            'nuclide-ui-pulse-button': true,
            selected: isSelected,
          },
          className,
        )}
        style={{
          height: size,
          width: size,
          ...style,
        }}
        href="#"
        aria-label={ariaLabel}
        onClick={onClick}
        onMouseOver={onMouseOver}
        onMouseLeave={onMouseLeave}
        role="button">
        <div className="nuclide-ui-pulse-button--inner-circle" />
        <div className="nuclide-ui-pulse-button--cover-circle" />
      </a>
    );
  }
}
