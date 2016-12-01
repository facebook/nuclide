'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {React, ReactDOM} from 'react-for-atom';
import classnames from 'classnames';

import ignoreTextSelectionEvents from './ignoreTextSelectionEvents';

type DefaultProps = {
  disabled: boolean,
  indeterminate: boolean,
  label: string,
  onClick: (event: SyntheticEvent) => mixed,
};

type Props = {
  className?: string,
  checked: boolean,
  disabled: boolean,
  indeterminate: boolean,
  label: string,
  onChange: (isChecked: boolean) => mixed,
  onClick: (event: SyntheticEvent) => mixed,
};

/**
 * A checkbox component with an input checkbox and a label. We restrict the label to a string
 * to ensure this component is pure.
 */
export class Checkbox extends React.PureComponent {
  props: Props;

  static defaultProps: DefaultProps = {
    disabled: false,
    indeterminate: false,
    label: '',
    onClick(event) {},
  };

  constructor(props: Object) {
    super(props);
    (this: any)._onChange = this._onChange.bind(this);
  }

  componentDidMount() {
    this._setIndeterminate();
  }

  componentDidUpdate() {
    this._setIndeterminate();
  }

  _onChange(event: SyntheticEvent) {
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
    ReactDOM.findDOMNode(this.refs.input).indeterminate = this.props.indeterminate;
  }

  render(): React.Element<any> {
    const {
      checked,
      className,
      disabled,
      // eslint-disable-next-line no-unused-vars
      indeterminate, // exclude `indeterminate` from `remainingProps`
      label,
      onClick,
    } = this.props;
    const text = label === ''
      ? null
      : <span className="nuclide-ui-checkbox-label-text">{' '}{label}</span>;
    return (
      <label
        className={classnames(className, 'nuclide-ui-checkbox-label', {
          'nuclide-ui-checkbox-disabled': disabled,
        })}
        onClick={onClick && ignoreTextSelectionEvents(onClick)}>
        <input
          checked={checked}
          className="input-checkbox nuclide-ui-checkbox"
          disabled={disabled}
          onChange={this._onChange}
          ref="input"
          type="checkbox"
        />
        {text}
      </label>
    );
  }
}
