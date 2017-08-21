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

import type {Option} from './Dropdown';

import invariant from 'assert';
import React from 'react';
import {Button, ButtonSizes} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import {Dropdown} from './Dropdown';
import classnames from 'classnames';
import electron from 'electron';
const {remote} = electron;
invariant(remote != null);

type ButtonSize = 'EXTRA_SMALL' | 'SMALL' | 'LARGE';

type Props = {
  buttonComponent?: ReactClass<any>,
  changeDisabled?: boolean,
  className?: string,
  confirmDisabled?: boolean,
  onChange?: (value: any) => mixed,
  onConfirm: (value: any) => mixed,
  options: Array<Option>,
  size?: ?ButtonSize,
  value: any,
};

export class SplitButtonDropdown extends React.Component {
  props: Props;

  render(): React.Element<any> {
    const {
      buttonComponent,
      changeDisabled,
      className,
      confirmDisabled,
      onChange,
      onConfirm,
      options,
      size,
      value,
    } = this.props;
    const selectedOption = this._findSelectedOption(options) || options[0];
    invariant(selectedOption.type !== 'separator');
    const ButtonComponent = buttonComponent || Button;
    const dropdownOptions = options.map(option => ({
      ...option,
      selectedLabel: '',
    }));

    return (
      <ButtonGroup
        className={classnames(className, 'nuclide-ui-split-button-dropdown')}>
        <ButtonComponent
          size={size == null ? undefined : size}
          disabled={confirmDisabled === true}
          icon={selectedOption.icon || undefined}
          onClick={onConfirm}>
          {// flowlint-next-line sketchy-null-mixed:off, sketchy-null-string:off
          selectedOption.selectedLabel || selectedOption.label || ''}
        </ButtonComponent>
        <Dropdown
          size={this._getDropdownSize(size)}
          disabled={changeDisabled === true}
          options={dropdownOptions}
          value={value}
          onChange={onChange}
        />
      </ButtonGroup>
    );
  }

  _getDropdownSize(size: ?ButtonSize): 'sm' | 'xs' | 'lg' {
    switch (size) {
      case ButtonSizes.EXTRA_SMALL:
        return 'xs';
      case ButtonSizes.SMALL:
        return 'sm';
      case ButtonSizes.LARGE:
        return 'lg';
      default:
        return 'sm';
    }
  }

  _findSelectedOption(options: Array<Option>): ?Option {
    let result = null;
    for (const option of options) {
      if (option.type === 'separator') {
        continue;
      } else if (option.type === 'submenu') {
        const submenu = ((option.submenu: any): Array<Option>);
        result = this._findSelectedOption(submenu);
      } else if (option.value === this.props.value) {
        result = option;
      }

      if (result) {
        break;
      }
    }
    return result;
  }
}

export {ButtonSizes};
