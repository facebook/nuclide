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
import {AtomInput} from './AtomInput';
import {Block} from './Block';
import {DateSelector} from './DateSelector';

const ONE_WEEK = 1000 * 60 * 60 * 24 * 7;

class BasicExample extends React.Component<any, {date: ?Date}> {
  constructor(props: any) {
    super(props);
    this.state = {date: new Date()};
  }

  _onChangeDate = (date: ?Date): void => {
    this.setState({date});
  };

  render(): React.Node {
    return (
      <Block>
        <DateSelector
          start={this.state.date}
          earliestDate={new Date(Date.now() - ONE_WEEK)}
          latestDate={new Date(Date.now() + ONE_WEEK)}
          onDatesChange={this._onChangeDate}
        />
      </Block>
    );
  }
}

class RangeExample extends React.Component<any, {start: ?Date, end: ?Date}> {
  constructor(props: any) {
    super(props);
    this.state = {start: null, end: null};
  }

  _onChangeDate = (start: ?Date, end: ?Date): void => {
    this.setState({start, end});
  };

  render(): React.Node {
    return (
      <Block>
        <DateSelector
          start={this.state.start}
          end={this.state.end}
          latestDate={new Date(Date.now() + ONE_WEEK)}
          onDatesChange={this._onChangeDate}
          selectRange={true}
        />
      </Block>
    );
  }
}

class OpenOnFocusExample extends React.Component<any, {date: ?Date}> {
  constructor(props: any) {
    super(props);
    this.state = {date: new Date()};
  }

  _onChangeDate = (date: ?Date): void => {
    this.setState({date});
  };

  render(): React.Node {
    return (
      <Block>
        <div style={{height: '27em'}}>
          <DateSelector
            start={this.state.date}
            onDatesChange={this._onChangeDate}
            showOnlyOnFocus={true}>
            <AtomInput
              value={this.state.date ? this.state.date.toDateString() : ''}
              placeholderText="selected date"
            />
          </DateSelector>
        </div>
      </Block>
    );
  }
}

export const DateSelectorExamples = {
  sectionName: 'DateSelector',
  description: 'Renders a date selector.',
  examples: [
    {
      title: 'Select single date example',
      component: BasicExample,
    },
    {
      title: 'Select range of dates example',
      component: RangeExample,
    },
    {
      title: 'Open calendar on focus example',
      component: OpenOnFocusExample,
    },
  ],
};
