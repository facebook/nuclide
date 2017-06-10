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

/* global alert */

import React from 'react';
import {Dropdown} from './Dropdown';
import {ModalMultiSelect} from './ModalMultiSelect';
import {SplitButtonDropdown} from './SplitButtonDropdown';

const DropdownExample = (() => {
  const options = [
    {value: 1, label: 'One'},
    {value: 2, label: 'Two'},
    {value: 3, label: 'Three'},
    {value: 4, label: 'Four'},
  ];
  return (): React.Element<any> => (
    <div>
      <Dropdown options={options} value={2} />
    </div>
  );
})();

const SplitButtonDropdownExample = (() => {
  const options = [
    {value: 1, label: 'Build', icon: 'tools'},
    {value: 2, label: 'Run', icon: 'triangle-right', selectedLabel: 'Run It!'},
    {value: 3, label: 'Rocket', icon: 'rocket'},
    {type: 'separator'},
    {value: 4, label: 'Squirrel', icon: 'squirrel'},
    {value: 5, label: 'Beaker', icon: 'telescope', disabled: true},
  ];
  return (): React.Element<any> => (
    <div>
      <SplitButtonDropdown
        options={options}
        value={2}
        onConfirm={// eslint-disable-next-line no-alert
        x => alert(`You selected ${x}!`)}
      />
    </div>
  );
})();

class ModalMultiSelectExample extends React.Component {
  state: {value: Array<number>};

  constructor(props: void) {
    super(props);
    this.state = {value: [2]};
  }

  render(): React.Element<any> {
    const options = [
      {value: 1, label: 'One'},
      {value: 2, label: 'Two'},
      {value: 3, label: 'Three'},
      {value: 4, label: 'Four'},
    ];
    return (
      <ModalMultiSelect
        options={options}
        onChange={value => {
          this.setState({value});
        }}
        value={this.state.value}
      />
    );
  }
}

export const DropdownExamples = {
  sectionName: 'Dropdowns',
  description: 'For selecting things.',
  examples: [
    {
      title: 'Dropdown',
      component: DropdownExample,
    },
    {
      title: 'Split Button Dropdown',
      component: SplitButtonDropdownExample,
    },
    {
      title: 'Modal Multi-Select',
      component: ModalMultiSelectExample,
    },
  ],
};
