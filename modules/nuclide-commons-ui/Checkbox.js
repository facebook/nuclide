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
import classnames from 'classnames';
import addTooltip from './addTooltip';

import ignoreTextSelectionEvents from './ignoreTextSelectionEvents';

type DefaultProps = {
  disabled: boolean,
  indeterminate: boolean,
  label: string,
  onClick: (event: SyntheticMouseEvent<>) => mixed,
  onMouseDown: (event: SyntheticMouseEvent<>) => mixed,
};

type Props = {
  className?: string,
  checked: boolean,
  disabled: boolean,
  indeterminate: boolean,
  label: string,
  onChange: (isChecked: boolean) => mixed,
  onClick: (event: SyntheticMouseEvent<>) => mixed,
  tooltip?: atom$TooltipsAddOptions,
  title?: ?string,
  onMouseDown: (event: SyntheticMouseEvent<>) => mixed,
};

/**
 * A checkbox component with an input checkbox and a label. We restrict the label to a string
 * to ensure this component is pure.
 */
export class Checkbox extends React.PureComponent<Props> {
  _input: ?HTMLInputElement;

  static defaultProps: DefaultProps = {
    disabled: false,
    indeterminate: false,
    label: '',
    onClick(event) {},
    onMouseDown(event) {},
  };

  constructor(props: Props) {
    super(props);
    (this: any)._onChange = this._onChange.bind(this);
  }

  componentDidMount() {
    this._setIndeterminate();
  }

  componentDidUpdate() {
    this._setIndeterminate();
  }

  _onChange(event: SyntheticEvent<>) {
    const isChecked = ((event.target: any): HTMLInputElement).checked;
    this.props.onChange.call(null, isChecked);
  }

  /*
   * Syncs the `indeterminate` prop to the underlying `<input>`. `indeterminate` is intentionally
   * not settable via HTML; it must be done on the `HTMLInputElement` instance in script.
   *
   * @see https://www.w3.org/TR/html5/forms.html#the-input-element
   */
  _setIndeterminate(): void {
    if (this._input == null) {
      return;
    }
    this._input.indeterminate = this.props.indeterminate;
  }

  render(): React.Node {
    const {
      checked,
      className,
      disabled,
      // eslint-disable-next-line no-unused-vars
      indeterminate, // exclude `indeterminate` from `remainingProps`
      label,
      onClick,
      tooltip,
      title,
      onMouseDown,
    } = this.props;

    const ref = tooltip ? addTooltip(tooltip) : null;
    const text =
      label === '' ? null : (
        <span className="nuclide-ui-checkbox-label-text"> {label}</span>
      );
    return (
      <label
        className={classnames(className, 'nuclide-ui-checkbox-label', {
          'nuclide-ui-checkbox-disabled': disabled,
        })}
        // eslint-disable-next-line nuclide-internal/jsx-simple-callback-refs
        ref={ref}
        onClick={onClick && ignoreTextSelectionEvents(onClick)}
        title={title}>
        <input
          checked={checked}
          className="input-checkbox nuclide-ui-checkbox"
          disabled={disabled}
          onChange={this._onChange}
          onMouseDown={onMouseDown}
          ref={el => {
            this._input = el;
          }}
          type="checkbox"
        />
        {text}
      </label>
    );
  }
}
