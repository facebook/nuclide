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

import type {SettingsPropsDefault} from './SettingsUtils';

import {normalizeIdentifier} from './SettingsUtils';
import * as React from 'react';

type Props = SettingsPropsDefault & {
  value: atom$Color,
};

export default class SettingsColorInput extends React.Component<Props> {
  _handleChange = (event: SyntheticEvent<>) => {
    const value = ((event.target: any): HTMLInputElement).value;
    this.props.onChange(value);
  };

  render(): React.Node {
    const {keyPath, title, description, value} = this.props;
    const id = normalizeIdentifier(keyPath);

    return (
      <div className="color">
        <label className="control-label">
          <input
            id={id}
            type="color"
            onChange={this._handleChange}
            value={value.toHexString()}
          />
          <div className="setting-title">{title}</div>
        </label>
        <div className="setting-description">{description}</div>
      </div>
    );
  }
}
