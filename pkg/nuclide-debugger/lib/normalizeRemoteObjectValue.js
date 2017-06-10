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

import type {EvaluationResult} from './types';

import invariant from 'assert';

export function normalizeRemoteObjectValue(
  remoteObject: ?Object,
): ?EvaluationResult {
  if (remoteObject == null) {
    return null;
  }
  const modifiedProperties = {};
  const normalizeUnderscores = field => {
    invariant(remoteObject != null);
    modifiedProperties[field] = remoteObject[field];
    const underscoreField = `_${field}`;
    if (
      remoteObject.hasOwnProperty(underscoreField) &&
      remoteObject[underscoreField] != null
    ) {
      modifiedProperties[field] = String(remoteObject[underscoreField]);
    } else if (
      remoteObject.hasOwnProperty(field) &&
      remoteObject[field] != null
    ) {
      modifiedProperties[field] = String(remoteObject[field]);
    }
  };
  ['type', 'description', 'objectId', 'value'].forEach(normalizeUnderscores);
  return {
    ...remoteObject,
    ...modifiedProperties,
  };
}
