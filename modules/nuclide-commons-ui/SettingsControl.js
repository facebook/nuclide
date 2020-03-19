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

import SettingsCheckbox from './SettingsCheckbox';
import SettingsInput from './SettingsInput';
import SettingsSelect from './SettingsSelect';
import SettingsColorInput from './SettingsColorInput';
import invariant from 'assert';
import * as React from 'react';

type Props = {
  keyPath: string,
  schema: atom$ConfigSchema,
  value: any,
  title: ?string,
  onChange: (value: any) => mixed,
  hideDetails?: boolean,
};

export default function SettingsControl(props: Props): React.Node {
  const {keyPath, value, onChange, schema, title, hideDetails} = props;
  const {description: settingDescription} = schema;

  const description = hideDetails === true ? '' : settingDescription;

  if (schema) {
    if (schema.enum) {
      return (
        // $FlowFixMe(>=0.53.0) Flow suppress
        <SettingsSelect
          description={description}
          keyPath={keyPath}
          onChange={onChange}
          title={title}
          value={value}
        />
      );
    } else if (schema.type === 'color') {
      return (
        // $FlowFixMe(>=0.53.0) Flow suppress
        <SettingsColorInput
          description={description}
          keyPath={keyPath}
          onChange={onChange}
          title={title}
          value={value}
        />
      );
    } else if (isBoolean(value) || schema.type === 'boolean') {
      return (
        // $FlowFixMe(>=0.53.0) Flow suppress
        <SettingsCheckbox
          description={description}
          keyPath={keyPath}
          onChange={onChange}
          title={title}
          value={value}
        />
      );
    } else if (Array.isArray(value) || schema.type === 'array') {
      if (isEditableArray(value)) {
        return (
          // $FlowFixMe(>=0.53.0) Flow suppress
          <SettingsInput
            description={description}
            keyPath={keyPath}
            onChange={onChange}
            title={title}
            value={value}
            type="array"
          />
        );
      }
    } else if (isObject(value) || schema.type === 'object') {
      invariant(false); // Not implemented.
    } else {
      const type = isNumber(value) ? 'number' : 'string';
      return (
        // $FlowFixMe(>=0.53.0) Flow suppress
        <SettingsInput
          description={description}
          keyPath={keyPath}
          onChange={onChange}
          title={title}
          value={value}
          type={type}
        />
      );
    }
  }

  return null;
}

function isBoolean(obj) {
  return (
    obj === true || obj === false || toString.call(obj) === '[object Boolean]'
  );
}

function isNumber(obj) {
  return toString.call(obj) === '[object Number]';
}

function isObject(obj) {
  const type = typeof obj;
  return type === 'function' || (type === 'object' && Boolean(obj));
}

function isEditableArray(array): boolean {
  for (let i = 0, len = array.length; i < len; i++) {
    const item = array[i];
    if (typeof item !== 'string') {
      return false;
    }
  }
  return true;
}
