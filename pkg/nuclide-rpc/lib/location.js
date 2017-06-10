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

import type {Location} from './types';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';

export function locationToString(location: Location): string {
  switch (location.type) {
    case 'source':
      return `${location.fileName}(${location.line})`;
    case 'builtin':
      return '<builtin>';
    default:
      throw new Error('Bad location type');
  }
}

export function locationsEqual(first: Location, second: Location): boolean {
  if (first.type !== second.type) {
    return false;
  }
  switch (first.type) {
    case 'source':
      invariant(second.type === 'source');
      return first.fileName === second.fileName && first.line === second.line;
    case 'builtin':
      return true;
    default:
      throw new Error('Bad location type');
  }
}

export function stripLocationsFileName(obj: any): any {
  function inspect(key: ?string, value: any): void {
    if (
      key === 'location' &&
      value !== null &&
      typeof value.fileName === 'string'
    ) {
      value.fileName = nuclideUri.basename(value.fileName);
    } else {
      stripLocationsFileName(value);
    }
  }
  if (Array.isArray(obj)) {
    obj.forEach(value => {
      inspect(null, value);
    });
  } else if (obj instanceof Map) {
    obj.forEach((value, key) => {
      inspect(key, value);
    });
  } else if (obj != null && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      inspect(key, obj[key]);
    });
  }
  return obj;
}
