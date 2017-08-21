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

import logger from './utils';
import {
  remoteObjectIdOfObjectId,
  endIndexOfObjectId,
  startIndexOfObjectId,
  countOfObjectId,
  getChildIds,
} from './ObjectId';
import {convertValue} from './values';
import invariant from 'assert';

import type {ObjectId} from './ObjectId';
import type {DbgpProperty} from './DbgpSocket';
import type {PropertyDescriptor} from '../../nuclide-debugger-base/lib/protocol-types';

export function convertProperties(
  id: ObjectId,
  properties: Array<DbgpProperty>,
): Array<PropertyDescriptor> {
  logger.debug('Got properties: ' + JSON.stringify(properties));
  return properties.map(property => convertProperty(id, property));
}

/**
 * Converts a DbgpProperty to a Chrome PropertyDescriptor.
 */
export function convertProperty(
  contextId: ObjectId,
  dbgpProperty: DbgpProperty,
): PropertyDescriptor {
  logger.debug(
    'Converting to Chrome property: ' + JSON.stringify(dbgpProperty),
  );
  const result = {
    configurable: false,
    enumerable: true,
    // flowlint-next-line sketchy-null-string:off
    name: dbgpProperty.$.name || 'Anonymous Property',
    value: convertValue(contextId, dbgpProperty),
  };
  return result;
}

/**
 * Given an ObjectId for a multi page object, gets PropertyDescriptors
 * for the object's children.
 */
export function getPagedProperties(
  pagedId: ObjectId,
): Array<PropertyDescriptor> {
  invariant(pagedId.elementRange);
  const pagesize = pagedId.elementRange.pagesize;
  const endIndex = endIndexOfObjectId(pagedId);

  const childIds = getChildIds(pagedId);
  return childIds.map(childId => {
    const childStartIndex = startIndexOfObjectId(childId, pagesize);
    const childCount = countOfObjectId(childId, pagesize, endIndex);
    return {
      configurable: false,
      enumerable: true,
      name: `Elements(${childStartIndex}..${childStartIndex + childCount - 1})`,
      value: {
        description: `${childCount} elements`,
        type: 'object',
        objectId: remoteObjectIdOfObjectId(childId),
      },
    };
  });
}
