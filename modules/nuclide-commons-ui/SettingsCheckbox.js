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

import {Checkbox} from './Checkbox';
import {normalizeIdentifier} from './SettingsUtils';
import * as React from 'react';

type Props = SettingsPropsDefault & {
  value: boolean,
};

export default class SettingsCheckbox extends React.Component<Props> {
  render(): React.Node {
    const keyPath = this.props.keyPath;
    const id = normalizeIdentifier(keyPath);
    const title = this.props.title;
    const description = this.props.description;
    const value = this.props.value;

    return (
      <div className="checkbox">
        <label htmlFor={id}>
          <Checkbox
            id={id}
            checked={value}
            className="setting-title"
            onChange={this.props.onChange}
            label={title}
          />
        </label>
        <div className="setting-description">{description}</div>
      </div>
    );
  }
}
