'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {Option} from './Dropdown';

import invariant from 'assert';
import {React} from 'react-for-atom';
import {Button, ButtonSizes} from './Button';
import {ButtonGroup} from './ButtonGroup';
import {Dropdown} from './Dropdown';
import electron from 'electron';

const {remote} = electron;
invariant(remote != null);

type ButtonSize = 'EXTRA_SMALL' | 'SMALL' | 'LARGE';

type Props = {
  value: any,
  buttonComponent?: ReactClass<any>,
  options: Array<Option>,
  onChange?: (value: any) => mixed,
  onConfirm: (value: any) => mixed,
  confirmDisabled?: boolean,
  changeDisabled?: boolean,
  size?: ?ButtonSize,
};

export class SplitButtonDropdown extends React.Component {
  props: Props;

  render(): React.Element<any> {
    const selectedOption = this.props.options.find(option => (
      option.type !== 'separator' && option.value === this.props.value),
    ) || this.props.options[0];

    invariant(selectedOption.type !== 'separator');

    const ButtonComponent = this.props.buttonComponent || Button;

    const dropdownOptions = this.props.options.map(option => ({
      ...option,
      selectedLabel: '',
    }));

    return (
      <ButtonGroup className="nuclide-ui-split-button-dropdown">
        <ButtonComponent
          size={this.props.size == null ? undefined : this.props.size}
          disabled={this.props.confirmDisabled === true}
          iconset={selectedOption.iconset || undefined}
          icon={selectedOption.icon || undefined}
          onClick={this.props.onConfirm}>
          {selectedOption.selectedLabel || selectedOption.label || ''}
        </ButtonComponent>
        <Dropdown
          size={this._getDropdownSize(this.props.size)}
          disabled={this.props.changeDisabled === true}
          options={dropdownOptions}
          value={this.props.value}
          onChange={this.props.onChange}
        />
      </ButtonGroup>
    );
  }

  _getDropdownSize(size: ?ButtonSize): 'sm' | 'xs' | 'lg' {
    switch (size) {
      case ButtonSizes.EXTRA_SMALL: return 'xs';
      case ButtonSizes.SMALL: return 'sm';
      case ButtonSizes.LARGE: return 'lg';
      default: return 'sm';
    }
  }

}

export {ButtonSizes};
