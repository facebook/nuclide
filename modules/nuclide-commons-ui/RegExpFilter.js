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

import type {ButtonSize} from './Button';

import {AtomInput} from './AtomInput';
import classnames from 'classnames';
import {Button, ButtonSizes} from './Button';
import {ButtonGroup} from './ButtonGroup';
import escapeStringRegexp from 'escape-string-regexp';
import * as React from 'react';

type Size = 'xs' | 'sm' | 'lg';

type Props = {
  value: RegExpFilterValue,
  inputWidth?: number,
  inputClassName?: string,
  onChange: (value: RegExpFilterChange) => mixed,
  size?: Size,
};

type State = {
  text: string,
  isRegExp: boolean,
  invalid: boolean,
};

export type RegExpFilterValue = {
  text: string,
  isRegExp: boolean,
  invalid: boolean,
};

export type FilterPattern = {
  pattern: ?RegExp,
  invalid: boolean,
};

export type RegExpFilterChange = {
  text: string,
  isRegExp: boolean,
};

export default class RegExpFilter extends React.Component<Props, State> {
  _currentValue: RegExpFilterValue;
  _input: ?AtomInput;

  constructor(props: Props) {
    super(props);
    this._currentValue = props.value;
  }

  UNSAFE_componentWillReceiveProps(props: Props): void {
    // We need to store this so that we can use it in the event handlers.
    this._currentValue = props.value;
  }

  render(): React.Node {
    const {
      value: {text, isRegExp, invalid},
    } = this.props;
    const size = this.props.size || 'sm';
    const buttonSize = getButtonSize(size);
    const inputWidth =
      this.props.inputWidth == null ? 200 : this.props.inputWidth;
    const inputClassName = classnames(
      'nuclide-ui-regexp-filter-input',
      this.props.inputClassName,
    );

    return (
      <ButtonGroup className="inline-block">
        <AtomInput
          ref={el => {
            this._input = el;
          }}
          invalid={invalid}
          className={inputClassName}
          size={size}
          width={inputWidth}
          placeholderText="Filter"
          onDidChange={this._handleTextChange}
          value={text}
        />
        <Button
          className="nuclide-ui-regexp-filter-button"
          size={buttonSize}
          selected={isRegExp}
          onClick={this._handleReToggleButtonClick}
          tooltip={{title: 'Use Regex'}}>
          .*
        </Button>
      </ButtonGroup>
    );
  }

  focus(): void {
    if (this._input == null) {
      return;
    }
    this._input.focus();
  }

  _handleReToggleButtonClick = (): void => {
    this.props.onChange({
      text: this._currentValue.text,
      isRegExp: !this._currentValue.isRegExp,
    });
  };

  _handleTextChange = (text: string): void => {
    if (text === this._currentValue.text) {
      return;
    }
    this.props.onChange({
      text,
      isRegExp: this._currentValue.isRegExp,
    });
  };
}

function getButtonSize(size: Size): ButtonSize {
  switch (size) {
    case 'xs':
      return ButtonSizes.EXTRA_SMALL;
    case 'sm':
      return ButtonSizes.SMALL;
    case 'lg':
      return ButtonSizes.LARGE;
    default:
      (size: empty);
      throw new Error(`Invalid size: ${size}`);
  }
}

export function getFilterPattern(
  text: string,
  isRegExp: boolean,
): FilterPattern {
  if (text === '') {
    return {pattern: null, invalid: false};
  }
  const source = isRegExp ? text : escapeStringRegexp(text);
  try {
    return {
      pattern: new RegExp(source, 'i'),
      invalid: false,
    };
  } catch (err) {
    return {
      pattern: null,
      invalid: true,
    };
  }
}
