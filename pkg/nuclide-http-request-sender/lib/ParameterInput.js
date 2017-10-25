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

import type {Parameter} from './types';

import * as React from 'react';
import {Button} from 'nuclide-commons-ui/Button';
import {AtomInput} from 'nuclide-commons-ui/AtomInput';

type PropsType = {
  index: number,
  paramKey: string,
  paramValue: string,
  isDuplicate: boolean,
  updateParameter: (index: number, parameter: Parameter) => void,
  removeParameter: (index: number) => void,
};

export class ParameterInput extends React.Component<PropsType, void> {
  props: PropsType;

  constructor(props: PropsType) {
    super(props);
    (this: any)._handleUpdateKey = this._handleUpdateKey.bind(this);
    (this: any)._handleUpdateValue = this._handleUpdateValue.bind(this);
    (this: any)._handleRemoveParameter = this._handleRemoveParameter.bind(this);
    (this: any)._getErrorStyle = this._getErrorStyle.bind(this);
  }

  _handleUpdateKey(newKey: string): void {
    this.props.updateParameter(this.props.index, {
      key: newKey,
      value: this.props.paramValue,
    });
  }

  _handleUpdateValue(newValue: string): void {
    this.props.updateParameter(this.props.index, {
      key: this.props.paramKey,
      value: newValue,
    });
  }

  _handleRemoveParameter(): void {
    this.props.removeParameter(this.props.index);
  }

  _getErrorStyle(): ?Object {
    return this.props.isDuplicate
      ? {
          borderColor: '#ff6347',
          boxShadow: '0 0 0 1px #ff6347',
          backgroundColor: '#312426',
        }
      : null;
  }
  render(): React.Node {
    const style = this._getErrorStyle();
    return (
      <div>
        <div className="nuclide-parameter-container">
          <div className="nuclide-parameter-input-container">
            <AtomInput
              onDidChange={this._handleUpdateKey}
              initialValue={this.props.paramKey}
              style={style}
            />
            <AtomInput
              onDidChange={this._handleUpdateValue}
              initialValue={this.props.paramValue}
              style={style}
            />
          </div>
          <Button
            className="nuclide-parameter-button"
            onClick={this._handleRemoveParameter}>
            X
          </Button>
        </div>
      </div>
    );
  }
}
