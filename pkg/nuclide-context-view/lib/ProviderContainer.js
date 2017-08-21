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
import {Section} from '../../nuclide-ui/Section';
import {track} from '../../nuclide-analytics';

type Props = {
  title: string,
  children?: React.Element<any>,
};

type State = {
  collapsed: boolean,
};

/**
 * Each context provider view is rendered inside a ProviderContainer.
 */
export class ProviderContainer extends React.Component {
  props: Props;
  state: State;

  constructor(props: Props): void {
    super(props);
    this.state = {
      collapsed: false,
    };
  }

  render(): ?React.Element<any> {
    return (
      <div className="nuclide-context-view-provider-container">
        <Section
          headline={this.props.title}
          collapsable={true}
          onChange={this._setCollapsed}
          collapsed={this.state.collapsed}>
          <div className="padded">
            {this.props.children}
          </div>
        </Section>
      </div>
    );
  }

  _setCollapsed = (collapsed: boolean): void => {
    this.setState({collapsed});
    track('nuclide-context-view-toggle-provider', {
      title: this.props.title,
      collapsed: String(collapsed),
    });
  };
}
