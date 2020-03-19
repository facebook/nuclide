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

import type {AddMessagesType, FunctionType} from './PanelViewModel';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Button} from 'nuclide-commons-ui/Button';
import * as React from 'react';

type Props = {
  addMessages: AddMessagesType,
  clear: FunctionType,
  changeMessageLine: FunctionType,
  changeMessageContent: FunctionType,
};

export default class PanelView extends React.Component<Props> {
  render(): React.Element<any> {
    return (
      <div>
        <Group severity="error" addMessages={this.props.addMessages} />
        <Group severity="warning" addMessages={this.props.addMessages} />
        <Group severity="info" addMessages={this.props.addMessages} />
        <Group
          severity="info"
          kind="review"
          addMessages={this.props.addMessages}
        />
        <br />
        <Button
          onClick={() => {
            this.props.clear();
          }}>
          Clear
        </Button>
        <br />
        <Button
          onClick={() => {
            this.props.changeMessageLine();
          }}>
          Change Messages Position to selection
        </Button>
        <br />
        <Button
          onClick={() => {
            this.props.changeMessageContent();
          }}>
          Change Messages Content
        </Button>
        <br />
      </div>
    );
  }
}

class Group extends React.Component<{
  addMessages: AddMessagesType,
  severity: 'error' | 'warning' | 'info',
  kind?: 'review',
}> {
  _input: ?AtomInput;

  _onButtonClick = (event: SyntheticMouseEvent<*>): void => {
    const input = this._input;
    if (input == null) {
      return;
    }
    const n = parseInt(input.getText(), 10);
    if (Number.isNaN(n)) {
      return;
    }
    const {severity, kind} = this.props;
    const option =
      severity === 'info' && kind === 'review'
        ? {
            getBlockComponent() {
              return BlockComponent;
            },
          }
        : null;
    this.props.addMessages(severity, n, kind, option);
  };

  render() {
    const {severity, kind} = this.props;
    return (
      <div>
        <h1>
          {severity}
          {kind ? ' + ' + kind : ''}
        </h1>
        <AtomInput
          ref={input => {
            this._input = input;
          }}
          initialValue="1"
        />
        <Button onClick={this._onButtonClick}>Add</Button>
      </div>
    );
  }
}

class BlockComponent extends React.Component<{}> {
  render() {
    return (
      <div>
        <h1>Hello! This is a DOM diagnostic message🐲</h1>
        <textarea />
      </div>
    );
  }
}
