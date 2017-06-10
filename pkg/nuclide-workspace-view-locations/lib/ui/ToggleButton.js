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

import type {IconName} from 'nuclide-commons-ui/Icon';

import {Icon} from 'nuclide-commons-ui/Icon';
import classnames from 'classnames';
import React from 'react';

type Position = 'top' | 'right' | 'bottom' | 'left';

type Props = {
  onDragEnter: () => void,
  position: Position,
  visible: boolean,
  open: boolean,
  toggle: () => void,
};

export class ToggleButton extends React.Component {
  props: Props;

  render(): React.Element<any> {
    const className = classnames(
      'nuclide-workspace-views-toggle-button',
      this.props.position,
      {
        'nuclide-workspace-views-toggle-button-visible': this.props.visible,
      },
    );
    return (
      <div className={className}>
        <div
          className={`nuclide-workspace-views-toggle-button-inner ${this.props.position}`}
          onClick={this.props.toggle}
          onDragEnter={this.props.onDragEnter}>
          <Icon icon={getIconName(this.props.position, this.props.open)} />
        </div>
      </div>
    );
  }
}

function getIconName(position: Position, open: boolean): IconName {
  switch (position) {
    case 'top':
      return open ? 'chevron-up' : 'chevron-down';
    case 'right':
      return open ? 'chevron-right' : 'chevron-left';
    case 'bottom':
      return open ? 'chevron-down' : 'chevron-up';
    case 'left':
      return open ? 'chevron-left' : 'chevron-right';
    default:
      throw new Error(`Invalid position: ${position}`);
  }
}
