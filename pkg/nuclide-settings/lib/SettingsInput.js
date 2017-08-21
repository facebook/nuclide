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

import type {SettingsPropsDefault} from './types';

import {AtomInput} from 'nuclide-commons-ui/AtomInput';
import React from 'react';
import {
  isDefaultConfigValue,
  getDefaultConfigValueString,
  normalizeIdentifier,
  parseValue,
  valueToString,
} from './settings-utils';

type Props = SettingsPropsDefault & {
  type: string,
  value: number | string | Array<any>,
};

export default class SettingsInput extends React.Component {
  props: Props;
  _ignoreInputCallback: boolean;

  constructor(props: Object) {
    super(props);
    this._ignoreInputCallback = false;
  }

  _updateInput(input: AtomInput, newValue: string) {
    this._ignoreInputCallback = true;
    input.setText(newValue);
    this._ignoreInputCallback = false;
  }

  _handleChange = (newValue_: string) => {
    let newValue = newValue_;
    if (this._ignoreInputCallback) {
      return;
    }

    newValue = parseValue(this.props.type, newValue);
    this.props.onChange(newValue);
  };

  _onFocus = () => {
    const keyPath = this.props.keyPath;
    const input = this.refs[keyPath];
    if (isDefaultConfigValue(keyPath)) {
      const defaultValue = getDefaultConfigValueString(keyPath);
      this._updateInput(input, defaultValue);
    }
  };

  _onBlur = () => {
    const keyPath = this.props.keyPath;
    const input = this.refs[keyPath];
    if (isDefaultConfigValue(keyPath, input.getText())) {
      this._updateInput(input, '');
    }
  };

  _getValue(): string {
    let value = valueToString(this.props.value);

    const defaultValue = getDefaultConfigValueString(this.props.keyPath);
    if (defaultValue === value) {
      value = '';
    }

    return value;
  }

  _getPlaceholder(): string {
    const defaultValue = getDefaultConfigValueString(this.props.keyPath);
    return defaultValue ? 'Default: ' + defaultValue : '';
  }

  // $FlowIgnore: This method requires declaring State's type
  componentDidUpdate(prevProps: Object, prevState: Object): void {
    const input = this.refs[this.props.keyPath];
    const value = this._getValue();
    if (input.getText() !== value) {
      this._updateInput(input, value);
    }
  }

  render(): React.Element<any> {
    const keyPath = this.props.keyPath;
    const id = normalizeIdentifier(keyPath);
    const title = this.props.title;
    const description = this.props.description;
    const value = this._getValue();
    const placeholder = this._getPlaceholder();

    return (
      <div>
        <label className="control-label">
          <div className="setting-title">
            {title}
          </div>
          <div className="setting-description">
            {description}
          </div>
        </label>
        <div className="controls">
          <div className="editor-container">
            <subview>
              <AtomInput
                className={id}
                initialValue={value}
                onDidChange={this._handleChange}
                onFocus={this._onFocus}
                onBlur={this._onBlur}
                placeholderText={placeholder}
                ref={keyPath}
                text={value}
              />
            </subview>
          </div>
        </div>
      </div>
    );
  }
}
