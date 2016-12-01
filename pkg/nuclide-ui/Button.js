'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import classnames from 'classnames';
import {React} from 'react-for-atom';
import {maybeToString} from '../commons-node/string';
import addTooltip from './add-tooltip';

export type ButtonType = 'PRIMARY' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
export type ButtonSize = 'EXTRA_SMALL' | 'SMALL' | 'LARGE';
type ButtonNodeName = 'button' | 'a';

type Props = {
  /** Icon name, without the `icon-` prefix. E.g. `'arrow-up'` */
  icon?: string,
  iconset?: ?string,
  /** Optional specifier for special buttons, e.g. primary, info, success or error buttons. */
  buttonType?: ButtonType,
  selected?: boolean,
  /**  */
  size?: ButtonSize,
  className?: string,
  /** The button's content; generally a string. */
  children?: mixed,
  /** Allows specifying an element other than `button` to be used as the wrapper node. */
  wrapperElement?: ButtonNodeName,
  tooltip?: atom$TooltipsAddOptions,
};

export const ButtonSizes = Object.freeze({
  EXTRA_SMALL: 'EXTRA_SMALL',
  SMALL: 'SMALL',
  LARGE: 'LARGE',
});

export const ButtonTypes = Object.freeze({
  PRIMARY: 'PRIMARY',
  INFO: 'INFO',
  SUCCESS: 'SUCCESS',
  WARNING: 'WARNING',
  ERROR: 'ERROR',
});

const ButtonSizeClassnames = Object.freeze({
  EXTRA_SMALL: 'btn-xs',
  SMALL: 'btn-sm',
  LARGE: 'btn-lg',
});

const ButtonTypeClassnames = Object.freeze({
  PRIMARY: 'btn-primary',
  INFO: 'btn-info',
  SUCCESS: 'btn-success',
  WARNING: 'btn-warning',
  ERROR: 'btn-error',
});

/**
 * Generic Button wrapper.
 */
export const Button = (props: Props) => {
  const {
    icon,
    iconset,
    buttonType,
    selected,
    size,
    children,
    className,
    wrapperElement,
    tooltip,
    ...remainingProps
  } = props;
  const sizeClassname = size == null ? '' : ButtonSizeClassnames[size] || '';
  const buttonTypeClassname = buttonType == null ? '' : ButtonTypeClassnames[buttonType] || '';
  const ref = tooltip ? addTooltip(tooltip) : null;
  const newClassName = classnames(
    className,
    'btn',
    {
      [`icon ${iconset || 'icon'}-${maybeToString(icon)}`]: icon != null,
      [sizeClassname]: size != null,
      selected,
      [buttonTypeClassname]: buttonType != null,
    },
  );
  const Wrapper = wrapperElement == null ? 'button' : wrapperElement;
  return (
    <Wrapper className={newClassName} ref={ref} {...remainingProps}>
      {children}
    </Wrapper>
  );
};
