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

import React from 'react';

import {Icon} from 'nuclide-commons-ui/Icon';
import addTooltip from 'nuclide-commons-ui/addTooltip';
import featureConfig from 'nuclide-commons-atom/feature-config';
import classnames from 'classnames';

type Props = {
  result: ?{
    percentage: number,
    providerName: string,
    icon?: IconName,
  },
  pending: boolean,
  // true iff we are currently displaying uncovered regions in the editor.
  isActive: boolean,
  onClick: Function,
};

const REALLY_BAD_THRESHOLD = 50;
const NOT_GREAT_THRESHOLD = 80;
const COLOR_DISPLAY_SETTING = 'nuclide-type-coverage.colorizeStatusBar';

export class StatusBarTileComponent extends React.Component {
  props: Props;

  constructor(props: Props) {
    super(props);
  }

  render(): ?React.Element<any> {
    const result = this.props.result;
    if (result != null) {
      const percentage = result.percentage;
      let colorClasses: {[classname: string]: boolean} = {};
      if (featureConfig.get(COLOR_DISPLAY_SETTING)) {
        colorClasses = {
          'text-error': percentage <= REALLY_BAD_THRESHOLD,
          'text-warning': percentage > REALLY_BAD_THRESHOLD &&
            percentage <= NOT_GREAT_THRESHOLD,
          // Nothing applied if percentage > NOT_GREAT_THRESHOLD,
          'nuclide-type-coverage-status-bar-active': this.props.isActive,
        };
      }
      const classes: string = classnames({
        'nuclide-type-coverage-status-bar-pending': this.props.pending,
        'nuclide-type-coverage-status-bar-ready': !this.props.pending,
        ...colorClasses,
      });
      const formattedPercentage: string = `${Math.floor(percentage)}%`;
      const tooltipString = getTooltipString(
        formattedPercentage,
        result.providerName,
      );
      return (
        <div
          style={{cursor: 'pointer'}}
          onClick={this.props.onClick}
          className={classes}
          ref={addTooltip({
            title: tooltipString,
            delay: 0,
            placement: 'top',
          })}>
          {this._getIconElement(result.icon)}
          {formattedPercentage}
        </div>
      );
    } else {
      return null;
    }
  }

  _getIconElement(icon: ?IconName): ?React.Element<any> {
    if (icon == null) {
      return null;
    }
    return <Icon icon={icon} />;
  }
}

function getTooltipString(
  formattedPercentage: string,
  providerName: string,
): string {
  return (
    `This file is ${formattedPercentage} covered by ${providerName}.<br/>` +
    'Click to toggle display of uncovered areas.'
  );
}
