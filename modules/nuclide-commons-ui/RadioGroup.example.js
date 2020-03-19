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
import RadioGroup from './RadioGroup';

const labels = ['choose', 'from', 'one of', 'several', 'options'];

class RadioGroupExample extends React.Component<any, {selectedIndex: number}> {
  constructor(props: any) {
    super(props);
    this.state = {
      selectedIndex: 0,
    };
  }

  onSelectedChange = (selectedIndex: number): void => {
    this.setState({
      selectedIndex,
    });
  };

  render(): React.Node {
    return (
      <Block>
        <RadioGroup
          selectedIndex={this.state.selectedIndex}
          optionLabels={labels}
          onSelectedChange={this.onSelectedChange}
        />
      </Block>
    );
  }
}

export const RadioGroupExamples = {
  sectionName: 'RadioGroup',
  description: '',
  examples: [
    {
      title: '',
      component: RadioGroupExample,
    },
  ],
};
