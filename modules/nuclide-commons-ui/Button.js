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

import type {IconName} from './Icon';

import classnames from 'classnames';
import * as React from 'react';
import ReactDOM from 'react-dom';
import {maybeToString} from 'nuclide-commons/string';
import {omit} from 'lodash';
import addTooltip from './addTooltip';

export type ButtonType = 'PRIMARY' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
export type ButtonSize = 'EXTRA_SMALL' | 'SMALL' | 'LARGE';
type ButtonNodeName = 'button' | 'a';

type Props = {
  // Icon name, without the `icon-` prefix. E.g. `'arrow-up'`
  icon?: IconName,
  // Optional specifier for special buttons, e.g. primary, info, success or error buttons.
  buttonType?: ?ButtonType,
  // A lot like a ref, however we only accept the callback form so we can
  // compose it with tooltips, which are implemented using refs
  onButtonDOMNodeChange?: (?HTMLButtonElement) => mixed,
  selected?: boolean,
  size?: ButtonSize,
  className?: string,
  // The button's content; generally a string.
  children?: mixed,
  // Allows specifying an element other than `button` to be used as the wrapper node.
  wrapperElement?: ButtonNodeName,
  tooltip?: atom$TooltipsAddOptions,
  disabled?: boolean,
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
export class Button extends React.Component<Props> {
  _button: ?HTMLButtonElement;
  _removeTooltip: ?() => void;

  focus(): void {
    const node = ReactDOM.findDOMNode(this);
    if (node == null) {
      return;
    }
    // $FlowFixMe
    node.focus();
  }

  _onRefChange = (button: ?HTMLButtonElement) => {
    const {disabled, onButtonDOMNodeChange, tooltip} = this.props;

    this._button = button;
    if (onButtonDOMNodeChange) {
      onButtonDOMNodeChange(this._button);
    }

    // When the element goes away (e.g. on unmount), remove the tooltip.
    if (button == null && this._removeTooltip != null) {
      this._removeTooltip();
    }

    if (!disabled && tooltip && button != null) {
      const updateTooltip = addTooltip(tooltip);
      updateTooltip(button);
      this._removeTooltip = () => {
        updateTooltip(null);
        this._removeTooltip = null;
      };
    }
  };

  render(): React.Node {
    const {
      disabled,
      icon,
      buttonType,
      selected,
      size,
      children,
      className,
      wrapperElement,
      tooltip,
      ...remainingProps
    } = this.props;

    const buttonProps = omit(remainingProps, 'onButtonDOMNodeChange');

    const sizeClassname = size == null ? '' : ButtonSizeClassnames[size] || '';
    const buttonTypeClassname =
      buttonType == null ? '' : ButtonTypeClassnames[buttonType] || '';

    const titleToolTip = tooltip && disabled ? tooltip.title : null;
    const newClassName = classnames(className, 'btn', {
      [`icon icon-${maybeToString(icon)}`]: icon != null,
      [sizeClassname]: size != null,
      selected,
      [buttonTypeClassname]: buttonType != null,
    });
    const Wrapper = wrapperElement == null ? 'button' : wrapperElement;
    return (
      <Wrapper
        className={newClassName}
        // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
        ref={this._onRefChange}
        disabled={disabled}
        {...buttonProps}
        title={titleToolTip}>
        {children}
      </Wrapper>
    );
  }
}
