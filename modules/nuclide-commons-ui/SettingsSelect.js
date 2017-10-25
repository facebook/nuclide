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

import featureConfig from 'nuclide-commons-atom/feature-config';
import {normalizeIdentifier} from './SettingsUtils';
import * as React from 'react';

type Props = SettingsPropsDefault & {
  value: number,
};

export default class SettingsSelect extends React.Component<Props> {
  _handleChange = (event: SyntheticEvent<>) => {
    const value = ((event.target: any): HTMLInputElement).value;
    this.props.onChange(value);
  };

  render(): React.Node {
    const keyPath = this.props.keyPath;
    const id = normalizeIdentifier(keyPath);
    const title = this.props.title;
    const description = this.props.description;
    const value = this.props.value;

    const options = featureConfig.getSchema(keyPath);

    const optionElements = [];
    if (options.enum) {
      options.enum.forEach((option, i) => {
        const optionValue = typeof option === 'object' ? option.value : option;
        const optionDescription =
          typeof option === 'object' ? option.description : option;
        optionElements.push(
          <option value={optionValue} key={i}>
            {optionDescription}
          </option>,
        );
      });
    }

    return (
      <div>
        <label className="control-label">
          <div className="setting-title">{title}</div>
          <div className="setting-description">{description}</div>
        </label>
        <select
          className="form-control"
          id={id}
          onChange={this._handleChange}
          value={value}>
          {optionElements}
        </select>
      </div>
    );
  }
}
