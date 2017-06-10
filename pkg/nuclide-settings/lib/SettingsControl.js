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

import SettingsCheckbox from './SettingsCheckbox';
import SettingsInput from './SettingsInput';
import SettingsSelect from './SettingsSelect';
import invariant from 'assert';
import React from 'react';

type Props = {
  keyPath: string,
  schema: atom$ConfigSchema,
  value: any,
  onChange: (value: any) => mixed,
};

export default function SettingsControl(props: Props): ?React.Element<any> {
  const {keyPath, value, onChange, schema} = props;
  const {description, title} = schema;

  if (schema) {
    if (schema.enum) {
      return (
        <SettingsSelect
          description={description}
          keyPath={keyPath}
          onChange={onChange}
          title={title}
          value={value}
        />
      );
    } else if (schema.type === 'color') {
      invariant(false); // Not implemented.
    } else if (isBoolean(value) || schema.type === 'boolean') {
      return (
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
