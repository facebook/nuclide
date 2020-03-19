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
import {ListView, ListViewItem} from './ListView';
import {Checkbox} from './Checkbox';
import {MultiSelectList} from './MultiSelectList';

const NOOP = () => {};

const ListviewExample1 = (): React.Element<any> => (
  <Block>
    <ListView alternateBackground={true}>
      {/* $FlowFixMe(>=0.53.0) Flow suppress */}
      <ListViewItem value={{id: 1}}>test1</ListViewItem>
      {/* $FlowFixMe(>=0.53.0) Flow suppress */}
      <ListViewItem value={{id: 2}}>test2</ListViewItem>
      {/* $FlowFixMe(>=0.53.0) Flow suppress */}
      <ListViewItem value={{id: 3}}>test3</ListViewItem>
      {/* $FlowFixMe(>=0.53.0) Flow suppress */}
      <ListViewItem value={{id: 4}}>test4</ListViewItem>
      {/* $FlowFixMe(>=0.53.0) Flow suppress */}
      <ListViewItem value={{id: 5}}>test5</ListViewItem>
    </ListView>
  </Block>
);
const ListviewExample2 = (): React.Element<any> => (
  <Block>
    <ListView alternateBackground={true}>
      {/* $FlowFixMe(>=0.53.0) Flow suppress */}
      <ListViewItem>
        <Checkbox
          checked={true}
          onClick={NOOP}
          onChange={NOOP}
          label="A Checkbox."
        />
      </ListViewItem>
      {/* $FlowFixMe(>=0.53.0) Flow suppress */}
      <ListViewItem>
        <Checkbox
          checked={true}
          onClick={NOOP}
          onChange={NOOP}
          label="A Checkbox."
        />
      </ListViewItem>
      {/* $FlowFixMe(>=0.53.0) Flow suppress */}
      <ListViewItem>
        <Checkbox
          checked={true}
          onClick={NOOP}
          onChange={NOOP}
          label="A Checkbox."
        />
      </ListViewItem>
      {/* $FlowFixMe(>=0.53.0) Flow suppress */}
      <ListViewItem>
        <Checkbox
          checked={false}
          onClick={NOOP}
          onChange={NOOP}
          label="A Checkbox."
        />
      </ListViewItem>
      {/* $FlowFixMe(>=0.53.0) Flow suppress */}
      <ListViewItem>
        <Checkbox
          checked={false}
          onClick={NOOP}
          onChange={NOOP}
          label="A Checkbox."
        />
      </ListViewItem>
    </ListView>
  </Block>
);

class MultiSelectListExample extends React.Component<
  void,
  {value: Array<number>},
> {
  constructor(props: void) {
    super(props);
    this.state = {value: [2]};
  }

  render(): React.Node {
    const options = [
      {value: 1, label: 'One'},
      {value: 2, label: 'Two'},
      {value: 3, label: 'Three'},
      {value: 4, label: 'Four'},
    ];

    return (
      // $FlowFixMe(>=0.53.0) Flow suppress
      <MultiSelectList
        options={options}
        value={this.state.value}
        onChange={value => {
          this.setState({value});
        }}
      />
    );
  }
}

export const ListviewExamples = {
  sectionName: 'ListView',
  description: '',
  examples: [
    {
      title: 'Simple ListView',
      component: ListviewExample1,
    },
    {
      title: 'Arbitrary components as list items',
      component: ListviewExample2,
    },
    {
      title: 'Multi-Select List',
      component: MultiSelectListExample,
    },
  ],
};
