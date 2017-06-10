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

import type {IconName} from 'nuclide-commons-ui/Icon';

import classnames from 'classnames';
import React from 'react';

import {maybeToString} from 'nuclide-commons/string';

type BadgeSize = 'medium' | 'small' | 'large';
type BadgeColor = 'info' | 'success' | 'warning' | 'error';

type Props = {
  className?: string,
  color?: BadgeColor,
  /** Octicon icon name, without the `icon-` prefix. E.g. `'arrow-up'` */
  icon?: IconName,
  size?: BadgeSize,
  /** The value displayed inside the badge. */
  value: number,
};

export const BadgeSizes = Object.freeze({
  medium: 'medium',
  small: 'small',
  large: 'large',
});

export const BadgeColors = Object.freeze({
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
});

const BadgeSizeClassNames = Object.freeze({
  small: 'badge-small',
  medium: 'badge-medium',
  large: 'badge-large',
});

const BadgeColorClassNames = Object.freeze({
  info: 'badge-info',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
});

export const Badge = (props: Props) => {
  const {className, color, icon, size, value} = props;
  const sizeClassName = size == null ? '' : BadgeSizeClassNames[size] || '';
  const colorClassName = color == null ? '' : BadgeColorClassNames[color] || '';
  const newClassName = classnames(className, 'badge', {
    [sizeClassName]: size != null,
    [colorClassName]: color != null,
    [`icon icon-${maybeToString(icon)}`]: icon != null,
  });
  return (
    <span className={newClassName}>
      {value}
    </span>
  );
};
