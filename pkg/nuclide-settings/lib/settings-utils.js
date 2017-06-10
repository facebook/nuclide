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

import featureConfig from 'nuclide-commons-atom/feature-config';

function getConfigValueString(keyPath: string): string {
  const value = featureConfig.get(keyPath);
  return valueToString(value);
}

export function normalizeIdentifier(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, '_');
}

export function isDefaultConfigValue(keyPath: string, value_: ?any): boolean {
  let value = value_;
  const defaultValue = getDefaultConfigValueString(keyPath);
  if (value) {
    value = valueToString(value);
  } else {
    value = getConfigValueString(keyPath);
  }
  return !value || defaultValue === value;
}

export function getDefaultConfigValue(keyPath: string): mixed {
  const params = {excludeSources: [atom.config.getUserConfigPath()]};
  return featureConfig.get(keyPath, params);
}

export function getDefaultConfigValueString(keyPath: string): string {
  return valueToString(getDefaultConfigValue(keyPath));
}

export function parseValue(type: string, value: any): any {
  let result = value;
  if (value === '') {
    result = undefined;
  } else if (type === 'number') {
    const floatValue = parseFloat(value);
    if (!isNaN(floatValue)) {
      result = floatValue;
    }
  } else if (type === 'array') {
    const arrayValue = (value ? value : '').split(',');
    result = arrayValue.filter(item => Boolean(item)).map(item => item.trim());
  }
  return result;
}

export function valueToString(value: any): string {
  if (Array.isArray(value)) {
    return value.join(', ');
  } else {
    return value != null ? value.toString() : '';
  }
}

// Remove spaces and hypens
export function strip(str: string): string {
  return str.replace(/\s+/g, '').replace(/-+/g, '');
}

/** Returns true if filter matches search string. Return true if filter is empty. */
export function matchesFilter(filter: string, searchString: string): boolean {
  if (filter.length === 0) {
    return true;
  }
  const needle = strip(filter.toLowerCase());
  const hay = strip(searchString.toLowerCase());
  return hay.indexOf(needle) !== -1;
}
