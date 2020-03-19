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

import type {Option} from './Dropdown';
import type {ButtonType} from './Button';

import invariant from 'assert';
import * as React from 'react';
import {Button, ButtonSizes} from './Button';
import {ButtonGroup} from './ButtonGroup';
import {Dropdown} from './Dropdown';
import classnames from 'classnames';
import electron from 'electron';
const {remote} = electron;
invariant(remote != null);

type ButtonSize = 'EXTRA_SMALL' | 'SMALL' | 'LARGE';

type Props = {
  buttonComponent?: React.ComponentType<any>,
  buttonType?: ?ButtonType,
  changeDisabled?: boolean,
  className?: string,
  confirmDisabled?: boolean,
  onChange?: (value: any) => mixed,
  onConfirm: (value: any) => mixed,
  options: Array<Option>,
  size?: ?ButtonSize,
  value: any,
  selectionComparator?: (dropdownValue: any, optionValue: any) => boolean,
  tabIndex?: string,
};

export class SplitButtonDropdown extends React.Component<Props> {
  render(): React.Node {
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
      selectionComparator,
    } = this.props;
    const selectedOption = this._findSelectedOption(options) || options[0];
    invariant(selectedOption.type !== 'separator');
    const ButtonComponent = buttonComponent || Button;
    // $FlowFixMe(>=0.53.0) Flow suppress
    const dropdownOptions = options.map(option => ({
      ...option,
      selectedLabel: '',
    }));

    return (
      <ButtonGroup
        className={classnames(className, 'nuclide-ui-split-button-dropdown')}>
        <ButtonComponent
          buttonType={this.props.buttonType}
          size={size == null ? undefined : size}
          disabled={confirmDisabled === true}
          icon={selectedOption.icon || undefined}
          onClick={onConfirm.bind(null, value)}
          tabIndex={this.props.tabIndex}>
          {// flowlint-next-line sketchy-null-mixed:off, sketchy-null-string:off
          selectedOption.selectedLabel || selectedOption.label || ''}
        </ButtonComponent>
        <Dropdown
          buttonType={this.props.buttonType}
          size={this._getDropdownSize(size)}
          disabled={changeDisabled === true}
          options={dropdownOptions}
          value={value}
          onChange={onChange}
          selectionComparator={selectionComparator}
          tabIndex={this.props.tabIndex}
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
    const selectionComparator =
      this.props.selectionComparator == null
        ? (a, b) => a === b
        : this.props.selectionComparator;
    for (const option of options) {
      if (option.type === 'separator') {
        continue;
      } else if (option.type === 'submenu') {
        const submenu = ((option.submenu: any): Array<Option>);
        result = this._findSelectedOption(submenu);
      } else if (selectionComparator(option.value, this.props.value)) {
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
