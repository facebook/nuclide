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

import type {IconName} from './Icon';

import {Icon} from './Icon';
import * as React from 'react';
import classnames from 'classnames';
import nullthrows from 'nullthrows';

export type Tab = {
  name: string,
  icon?: IconName,
  tabContent: React.Element<any>,
};

type Props = {
  tabs: Array<Tab>,
  activeTabName: ?string,
  closeable: boolean,
  onActiveTabChange: (tab: Tab) => void,
  onClose?: () => void,
  triggeringEvent: string,
  growable?: boolean,
};

export default class Tabs extends React.Component<Props> {
  static defaultProps = {
    closeable: false,
    triggeringEvent: 'onClick',
    growable: false,
  };

  _handleTabChange = (selectedTabName: string) => {
    if (typeof this.props.onActiveTabChange === 'function') {
      this.props.onActiveTabChange(
        nullthrows(this.props.tabs.find(tab => tab.name === selectedTabName)),
      );
    }
  };

  _renderTabMenu = (): React.Element<any> => {
    const closeButton = this.props.closeable ? (
      <div className="close-icon" onClick={this.props.onClose} />
    ) : null;
    const tabs = this.props.tabs.map(tab => {
      const icon = tab.icon == null ? null : <Icon icon={tab.icon} />;
      const handler = {};
      handler[this.props.triggeringEvent] = this._handleTabChange.bind(
        this,
        tab.name,
      );
      return (
        <li
          className={classnames({
            tab: true,
            active: this.props.activeTabName === tab.name,
            growable: this.props.growable,
          })}
          key={tab.name}
          title={tab.name}
          {...handler}>
          <div className="title">
            {icon}
            {tab.tabContent}
          </div>
          {closeButton}
        </li>
      );
    });
    return <ul className="tab-bar list-inline inset-panel">{tabs}</ul>;
  };

  render(): React.Node {
    return <div className="nuclide-tabs">{this._renderTabMenu()}</div>;
  }
}
