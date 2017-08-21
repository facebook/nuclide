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

import React from 'react';
import classnames from 'classnames';

import ignoreTextSelectionEvents from 'nuclide-commons-ui/ignoreTextSelectionEvents';

type DefaultProps = {
  disabled: boolean,
  onClick: (event: SyntheticEvent) => mixed,
};

type Props = {
  className?: string,
  toggled: boolean,
  disabled: boolean,
  label: ?string,
  onChange: (isToggled: boolean) => mixed,
  onClick: (event: SyntheticEvent) => mixed,
};

/**
 * A toggle component with an input toggle and a label. We restrict the label to a string
 * to ensure this component is pure.
 */
export class Toggle extends React.Component {
  props: Props;

  static defaultProps: DefaultProps = {
    disabled: false,
    onClick(event) {},
  };

  _onChange = (event: SyntheticEvent) => {
    const isToggled = ((event.target: any): HTMLInputElement).checked;
    this.props.onChange.call(null, isToggled);
  };

  render(): React.Element<any> {
    const {className, disabled, label, onClick, toggled} = this.props;
    const text =
      label === ''
        ? null
        : <span className="nuclide-ui-toggle-label-text">
            {' '}{label}
          </span>;
    return (
      <label
        className={classnames(className, 'nuclide-ui-toggle-label', {
          'nuclide-ui-toggle-disabled': disabled,
        })}
        onClick={onClick && ignoreTextSelectionEvents(onClick)}>
        <input
          checked={toggled}
          className="input-toggle"
          disabled={disabled}
          onChange={this._onChange}
          type="checkbox"
        />
        {text}
      </label>
    );
  }
}
