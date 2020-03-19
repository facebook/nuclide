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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import nullthrows from 'nullthrows';
import PulseButton from './PulseButton';

type Props = {
  ariaLabel: string,
  className?: string,
  isSelected?: boolean,
  onClick?: (SyntheticMouseEvent<>) => mixed,
  onDismiss?: () => mixed,
  size?: number,
  style?: {[key: string]: string},
  wrapperStyle?: {[key: string]: string},
  onMouseOver?: (SyntheticMouseEvent<>) => mixed,
  onMouseLeave?: (SyntheticMouseEvent<>) => mixed,
  tooltipText: string,
};

type State = {
  dismissed: boolean,
  isDismissing: boolean,
};

export default class PulseButtonWithTooltip extends React.Component<
  Props,
  State,
> {
  _divEl: ?HTMLDivElement;
  _disposables: ?UniversalDisposable;
  _tooltipDisposable: IDisposable;
  state = {
    isDismissing: false,
    dismissed: false,
  };

  componentDidMount() {
    this._tooltipDisposable = this._updateTooltip();
    nullthrows(this._getTooltip()).hide();
    this._disposables = new UniversalDisposable(this._tooltipDisposable);
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (!prevState.isDismissing && this.state.isDismissing) {
      const tooltip = this._getTooltip();
      if (tooltip != null) {
        tooltip.hide();
      }
      this.setState({dismissed: true});
    }

    if (prevProps.tooltipText !== this.props.tooltipText) {
      this._tooltipDisposable.dispose();
      this._tooltipDisposable = this._updateTooltip();
    }
  }

  componentWillUnmount() {
    nullthrows(this._disposables).dispose();
  }

  _updateTooltip(): IDisposable {
    return atom.tooltips.add(nullthrows(this._divEl), {
      item: createTooltipBody(this.props.tooltipText, this._handleDismiss),
      trigger: 'manual',
    });
  }

  _handleDivRef = (el: ?HTMLDivElement) => {
    this._divEl = el;
  };

  _handleDismiss = () => {
    this.setState({isDismissing: true});
    if (this.props.onDismiss != null) {
      this.props.onDismiss();
    }
  };

  _handleButtonClick = (e: SyntheticMouseEvent<>) => {
    const {onClick} = this.props;
    const tooltip = this._getTooltip();
    if (tooltip != null) {
      tooltip.show();
    }

    if (onClick != null) {
      onClick(e);
    }
  };

  _getTooltip(): ?atom$Tooltip {
    if (this._divEl == null) {
      return;
    }

    return atom.tooltips.findTooltips(this._divEl)[0];
  }

  render() {
    const {
      ariaLabel,
      className,
      isSelected,
      size,
      style,
      onMouseOver,
      onMouseLeave,
      wrapperStyle,
    } = this.props;

    if (this.state.dismissed) {
      return null;
    }

    return (
      <div ref={this._handleDivRef} style={wrapperStyle}>
        <PulseButton
          ariaLabel={ariaLabel}
          className={className}
          isSelected={isSelected}
          onClick={this._handleButtonClick}
          size={size}
          style={style}
          onMouseOver={onMouseOver}
          onMouseLeave={onMouseLeave}
        />
      </div>
    );
  }
}

function createTooltipBody(title, onDismiss) {
  const div = document.createElement('div');
  const p = document.createElement('p');
  p.innerText = title;
  div.appendChild(p);

  const button = document.createElement('button');
  button.classList.add('btn', 'btn-primary');
  button.innerText = 'Got it';
  button.addEventListener('click', onDismiss);
  div.appendChild(button);
  return div;
}
