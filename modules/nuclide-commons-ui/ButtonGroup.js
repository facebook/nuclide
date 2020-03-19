/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import classnames from 'classnames';
import * as React from 'react';

type ButtonGroupSize = 'EXTRA_SMALL' | 'SMALL' | 'LARGE';

type Props = {
  /** The size of the buttons within the group. Overrides any `size` props on child buttons. */
  size?: ButtonGroupSize,
  /** The contents of the ButtonGroup; Generally, an instance of `Button`. */
  children?: mixed,
  className?: string,
};

export const ButtonGroupSizes = Object.freeze({
  EXTRA_SMALL: 'EXTRA_SMALL',
  SMALL: 'SMALL',
  LARGE: 'LARGE',
});

const ButtonGroupSizeClassnames = Object.freeze({
  EXTRA_SMALL: 'btn-group-xs',
  SMALL: 'btn-group-sm',
  LARGE: 'btn-group-lg',
});

/**
 * Visually groups Buttons passed in as children.
 */
export const ButtonGroup = (props: Props) => {
  const {size, children, className} = props;
  const sizeClassName =
    size == null ? '' : ButtonGroupSizeClassnames[size] || '';
  const newClassName = classnames(className, 'btn-group', 'nuclide-btn-group', {
    [sizeClassName]: size != null,
  });
  return (
    // $FlowFixMe(>=0.53.0) Flow suppress
    <div className={newClassName}>{children}</div>
  );
};
