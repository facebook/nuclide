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

import * as React from 'react';
import {Block} from './Block';
import Tabs from './Tabs';

const tabs = [
  {
    name: 'one',
    tabContent: <div>One</div>,
  },
  {
    name: 'two',
    tabContent: <div>Two</div>,
  },
  {
    name: 'three',
    tabContent: <div>Three</div>,
  },
  {
    name: 'four',
    tabContent: <div>Four</div>,
  },
  {
    name: 'five',
    tabContent: <div>Five</div>,
  },
];

class TabExample extends React.Component<any, {activeTabName: string}> {
  constructor(props: any) {
    super(props);
    this.state = {
      activeTabName: 'one',
    };
  }

  handleTabChange = (newTabName: {
    name: string,
    tabContent: React.Element<any>,
  }): void => {
    this.setState({
      activeTabName: newTabName.name,
    });
  };

  render(): React.Node {
    const {activeTabName} = this.state;
    return (
      <Block>
        <Tabs
          tabs={tabs}
          activeTabName={activeTabName}
          triggeringEvent="onClick"
          onActiveTabChange={this.handleTabChange}
        />
        <div style={{padding: '2em 0 2em 0'}}>
          Showing content for tab "{activeTabName}".
        </div>
      </Block>
    );
  }
}

export const TabExamples = {
  sectionName: 'Tabs',
  description: '',
  examples: [
    {
      title: '',
      component: TabExample,
    },
  ],
};
