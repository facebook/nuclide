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

import type {RegExpFilterChange} from './RegExpFilter';

import * as React from 'react';
import {Block} from './Block';
import RegExpFilter, {getFilterPattern} from './RegExpFilter';

type State = {
  text: string,
  isRegExp: boolean,
  invalid: boolean,
};

class Example extends React.Component<{}, State> {
  state = {
    text: '',
    isRegExp: false,
    invalid: false,
  };

  render(): React.Node {
    const {text, isRegExp, invalid} = this.state;

    return (
      <div>
        <Block>
          <RegExpFilter
            value={{text, isRegExp, invalid}}
            onChange={this._handleChange}
          />
        </Block>
      </div>
    );
  }

  _handleChange = (change: RegExpFilterChange): void => {
    const {invalid} = getFilterPattern(change.text, change.isRegExp);
    this.setState({...change, invalid});
  };
}

export default {
  sectionName: 'RegExp Filter',
  description:
    'An input for filtering that allows the use of regular expressions.',
  examples: [
    {
      title: 'RegExpFilter',
      component: Example,
    },
  ],
};
