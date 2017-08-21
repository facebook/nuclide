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
import {Block} from 'nuclide-commons-ui/Block';
import RadioGroup from './RadioGroup';

const labels = ['choose', 'from', 'one of', 'several', 'options'];

class RadioGroupExample extends React.Component {
  state: {selectedIndex: number};

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

  render(): React.Element<any> {
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
