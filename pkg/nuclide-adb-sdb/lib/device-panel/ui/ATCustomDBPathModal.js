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

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import {Dropdown} from '../../../../nuclide-ui/Dropdown';
import {Button} from 'nuclide-commons-ui/Button';
import {ButtonGroup} from 'nuclide-commons-ui/ButtonGroup';
import React from 'react';

type Props = {|
  type: 'adb' | 'sdb',
  setCustomPath: (path: ?string) => void,
  dismiss: () => mixed,
  currentActivePath: ?string,
  currentCustomPath: ?string,
  registeredPaths: string[],
|};

type State = {|
  customPath: ?string,
|};

export class ATCustomDBPathModal extends React.Component {
  props: Props;
  state: State;

  constructor(props: Props) {
    super(props);
    this.state = {customPath: this.props.currentCustomPath};

    (this: any)._handleConfirm = this._handleConfirm.bind(this);
    (this: any)._handleCancel = this._handleCancel.bind(this);
    (this: any)._handleCustomPathChange = this._handleCustomPathChange.bind(
      this,
    );
  }

  _handleConfirm(): void {
    this.props.setCustomPath(this.state.customPath);
    this.props.dismiss();
  }

  _handleCancel(): void {
    this.props.dismiss();
  }

  _handleCustomPathChange(customPath: string): void {
    this.setState({customPath: customPath.length === 0 ? null : customPath});
  }

  _getCurrentActivePath(): React.Element<any> {
    return (
      <label>
        Active
        {' '}
        {this.props.type}
        {' '}
        path:
        {' '}
        <i><strong>{this.props.currentActivePath}</strong></i>
      </label>
    );
  }

  _getPathSelector(): React.Element<any> {
    return (
      <div>
        <Dropdown
          options={this.props.registeredPaths.map(path => ({
            label: path,
            value: path,
          }))}
          onChange={this._handleCustomPathChange}
          placeholder={`Set a fixed ${this.props.type} from a registered path`}
          value={null}
        />
        <div className="nuclide-adb-sdb-custom-path-input">
          <AtomInput
            size="sm"
            value={this.state.customPath || ''}
            placeholderText="... or from a custom path"
            onDidChange={this._handleCustomPathChange}
          />
        </div>
      </div>
    );
  }

  _getFooter(): React.Element<any> {
    return (
      <div className="nuclide-adb-sdb-custom-path-footer">
        <ButtonGroup>
          <Button onClick={this._handleConfirm} buttonType="PRIMARY">
            Confirm
          </Button>
          <Button onClick={this._handleCancel}>Cancel</Button>
        </ButtonGroup>
      </div>
    );
  }

  _getInfoBox(): React.Element<any> {
    return (
      <p>
        <small>
          A custom
          {' '}
          {this.props.type}
          {' '}
          path takes priority over any other path that nuclide knows.
          {' '}
          This is specially useful if you also use
          {' '}
          {this.props.type}
          {' '}
          from the command line along with nuclide.
          <br />
          Keep in mind that using two different versions of
          {' '}
          {this.props.type}
          {' '}
          simultaneously might break both tools.
        </small>
      </p>
    );
  }

  render(): React.Element<any> {
    return (
      <div>
        <div className="block">
          {this._getCurrentActivePath()}
        </div>
        <div className="block">
          {this._getPathSelector()}
        </div>
        <div className="block">
          {this._getInfoBox()}
        </div>
        <div className="block">
          {this._getFooter()}
        </div>
      </div>
    );
  }
}
