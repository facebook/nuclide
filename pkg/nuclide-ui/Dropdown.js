'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {Button, ButtonSizes} from './Button';
import {Icon} from './Icon';
import classnames from 'classnames';
import invariant from 'assert';
import electron from 'electron';
import {React} from 'react-for-atom';

const {remote} = electron;
invariant(remote != null);

// For backwards compat, we have to do some conversion here.
type ShortButtonSize = 'xs' | 'sm' | 'lg';
type ButtonSize = 'EXTRA_SMALL' | 'SMALL' | 'LARGE';

type Separator = {
  type: 'separator',
};

export type Option = Separator | {
  type?: void,
  value: any,
  label: string,
  selectedLabel?: string,
  icon?: string,
  iconset?: string,
  disabled?: boolean,
};

type Props = {
  className: string,
  disabled?: boolean,

  // Normally, a dropdown is styled like a button. This prop allows you to avoid that.
  isFlat: boolean,

  title: string,
  value: any,
  // If provided, this will be rendered as the label if the value is null.
  // Otherwise, we'll display the first option as selected by default.
  placeholder?: string,
  buttonComponent?: ReactClass<any>,
  options: Array<Option>,
  onChange?: (value: any) => mixed,
  size?: ShortButtonSize,
  tooltip?: atom$TooltipsAddOptions,
};

export class Dropdown extends React.Component {
  props: Props;

  static defaultProps = {
    className: '',
    disabled: false,
    isFlat: false,
    options: [],
    value: (null: any),
    title: '',
  };

  constructor(props: Props) {
    super(props);
    (this: any)._handleDropdownClick = this._handleDropdownClick.bind(this);
  }

  render(): React.Element<any> {
    const selectedOption = this.props.options.find(option => (
      option.type !== 'separator' && option.value === this.props.value),
    );

    let selectedLabel;
    if (selectedOption == null) {
      if (this.props.placeholder != null) {
        selectedLabel = this.props.placeholder;
      } else {
        selectedLabel = this._renderSelectedLabel(this.props.options[0]);
      }
    } else {
      selectedLabel = this._renderSelectedLabel(selectedOption);
    }

    return (
      <DropdownButton
        className={this.props.className}
        disabled={this.props.disabled}
        isFlat={this.props.isFlat}
        title={this.props.title}
        buttonComponent={this.props.buttonComponent}
        onExpand={this._handleDropdownClick}
        size={this.props.size}
        tooltip={this.props.tooltip}>
        {selectedLabel}
      </DropdownButton>
    );

  }

  _renderSelectedLabel(option: ?Option): ?string {
    let text = null;
    if (option == null) {
      text = '';
    } else if (typeof option.selectedLabel === 'string') {
      text = option.selectedLabel;
    } else if (typeof option.label === 'string') {
      text = option.label;
    }

    if (text == null || text === '') { return null; }
    return text;
  }

  _handleDropdownClick(event: SyntheticMouseEvent): void {
    const currentWindow = remote.getCurrentWindow();
    const menu = new remote.Menu();
    this.props.options.forEach(option => {
      if (option.type === 'separator') {
        menu.append(new remote.MenuItem({type: 'separator'}));
        return;
      }
      menu.append(new remote.MenuItem({
        type: 'checkbox',
        checked: this.props.value === option.value,
        label: option.label,
        enabled: option.disabled !== true,
        click: () => {
          if (this.props.onChange != null) {
            this.props.onChange(option.value);
          }
        },
      }));
    });
    menu.popup(currentWindow, event.clientX, event.clientY);
  }

}

type DropdownButtonProps = {
  buttonComponent?: ReactClass<any>,
  children?: any,
  className: string,
  disabled?: boolean,
  isFlat?: boolean,
  title?: string,
  size?: ShortButtonSize,
  tooltip?: atom$TooltipsAddOptions,
  onExpand?: (event: SyntheticMouseEvent) => void,
};

const noop = () => {};

/**
 * Just the button part. This is useful for when you want to customize the dropdown behavior (e.g.)
 * show it asynchronously.
 */
export function DropdownButton(props: DropdownButtonProps): React.Element<any> {
  const ButtonComponent = props.buttonComponent || Button;
  const className = classnames(
    'nuclide-ui-dropdown',
    props.className,
    {
      'nuclide-ui-dropdown-flat': props.isFlat === true,
    },
  );

  const label = props.children == null
    ? null
    : <span className="nuclide-dropdown-label-text-wrapper">{props.children}</span>;

  return (
    <ButtonComponent
      tooltip={props.tooltip}
      size={getButtonSize(props.size)}
      className={className}
      disabled={props.disabled === true}
      onClick={props.onExpand || noop}>
      {label}
      <Icon
        icon="triangle-down"
        className="nuclide-ui-dropdown-icon"
      />
    </ButtonComponent>
  );
}

function getButtonSize(size: ?ShortButtonSize): ButtonSize {
  switch (size) {
    case 'xs': return 'EXTRA_SMALL';
    case 'sm': return 'SMALL';
    case 'lg': return 'LARGE';
    default: return 'SMALL';
  }
}

export {ButtonSizes};
