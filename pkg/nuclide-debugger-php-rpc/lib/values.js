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
import {base64Decode} from './helpers';
import {
  remoteObjectIdOfObjectId,
  pagedObjectId,
  singlePageObjectId,
} from './ObjectId';
import invariant from 'assert';

import type {DbgpProperty} from './DbgpSocket';
import type {ObjectId} from './ObjectId';
import type {
  RemoteObject,
  RemoteObjectId,
} from '../../nuclide-debugger-base/lib/protocol-types';

/**
 * Converts a dbgp value to a Chrome RemoteObject.
 */
export function convertValue(
  contextId: ObjectId,
  dbgpProperty: DbgpProperty,
): RemoteObject {
  switch (dbgpProperty.$.type) {
    case 'string':
      return convertStringValue(dbgpProperty);
    case 'int':
      return convertIntValue(dbgpProperty);
    case 'float':
      return convertFloatValue(dbgpProperty);
    case 'bool':
      return convertBoolValue(dbgpProperty);
    case 'null':
      return getNullValue();
    case 'undefined':
      return getUndefinedValue();
    case 'array':
      return convertArrayValue(contextId, dbgpProperty);
    case 'object':
      return convertObjectValue(contextId, dbgpProperty);
    default:
      // TODO: Remaining property types - closure, hashmap, ...
      return convertUnknownValue(dbgpProperty);
  }
}

function convertStringValue(dbgpProperty: DbgpProperty): RemoteObject {
  let value;
  if (dbgpProperty.hasOwnProperty('_')) {
    value =
      dbgpProperty.$.encoding === 'base64'
        ? // $FlowFixMe(peterhal)
          base64Decode(dbgpProperty._)
        : `TODO: Non-base64 encoded string: ${JSON.stringify(dbgpProperty)}`;
  } else {
    // zero length strings have no dbgpProperty._ property
    value = '';
  }

  return {
    type: 'string',
    value,
  };
}

function convertIntValue(dbgpProperty: DbgpProperty): RemoteObject {
  const value =
    dbgpProperty.$.encoding === 'base64'
      ? `TODO: Base64 encoded int: ${JSON.stringify(dbgpProperty)}`
      : dbgpProperty._;
  return {
    type: 'number',
    value,
  };
}

function convertFloatValue(dbgpProperty: DbgpProperty): RemoteObject {
  const value =
    dbgpProperty.$.encoding === 'base64'
      ? `TODO: Base64 encoded float: ${JSON.stringify(dbgpProperty)}`
      : dbgpProperty._;
  return {
    type: 'number',
    value,
  };
}

function convertBoolValue(dbgpProperty: DbgpProperty): RemoteObject {
  invariant(dbgpProperty._ != null);
  const value =
    dbgpProperty.$.encoding === 'base64'
      ? `TODO: Base64 encoded bool: ${JSON.stringify(dbgpProperty)}`
      : toBool(dbgpProperty._);
  return {
    type: 'boolean',
    value,
  };
}

function getNullValue(): RemoteObject {
  return {
    type: 'undefined',
    subtype: 'null',
    value: null,
  };
}

function getUndefinedValue(): RemoteObject {
  return {
    type: 'undefined',
    value: undefined,
  };
}

function convertArrayValue(
  contextId: ObjectId,
  dbgpProperty: DbgpProperty,
): RemoteObject {
  const remoteId = getAggregateRemoteObjectId(contextId, dbgpProperty);
  const numchildren = String(
    dbgpProperty.$.numchildren != null ? dbgpProperty.$.numchildren : 0,
  );
  let description = `Array[${numchildren}]`;
  if (dbgpProperty.$.recursive != null) {
    description = '* Recursive *';
  }
  return {
    description,
    type: 'object',
    objectId: remoteId,
  };
}

function convertObjectValue(
  contextId: ObjectId,
  dbgpProperty: DbgpProperty,
): RemoteObject {
  const remoteId = getAggregateRemoteObjectId(contextId, dbgpProperty);
  let description = getObjectDescription(dbgpProperty);
  if (dbgpProperty.$.recursive != null) {
    description = '* Recursive *';
  }
  return {
    description,
    type: 'object',
    objectId: remoteId,
  };
}

function getObjectDescription(dbgpProperty: DbgpProperty): string | void {
  const {classname, numchildren} = dbgpProperty.$;
  switch (classname) {
    case 'HH\\Map':
    case 'HH\\ImmMap':
    case 'HH\\Vector':
    case 'HH\\ImmVector':
    case 'HH\\Set':
    case 'HH\\ImmSet':
      return `${classname}[${numchildren || 0}]`;
    default:
      return classname;
  }
}

function getAggregateRemoteObjectId(
  contextId: ObjectId,
  dbgpProperty: DbgpProperty,
): RemoteObjectId {
  // If the DbgpProperty represents an empty array or object, the `pagesize` and `numchildren`
  // will be omitted so we handle this "zero" case specially.
  const numchildren = Number(dbgpProperty.$.numchildren || 0);
  const pagesize = Number(dbgpProperty.$.pagesize) || 0;
  let pageCount = 0;
  if (pagesize !== 0) {
    pageCount = Math.trunc((numchildren + pagesize - 1) / pagesize) || 0;
  }
  logger.debug(
    `numchildren: ${numchildren} pagesize: ${pagesize} pageCount ${pageCount}`,
  );
  if (pageCount > 1) {
    const elementRange = {
      pagesize,
      startIndex: 0,
      count: numchildren,
    };
    invariant(dbgpProperty.$.fullname != null);
    return remoteObjectIdOfObjectId(
      pagedObjectId(contextId, dbgpProperty.$.fullname, elementRange),
    );
  } else {
    invariant(dbgpProperty.$.fullname != null);
    return remoteObjectIdOfObjectId(
      singlePageObjectId(contextId, dbgpProperty.$.fullname, 0),
    );
  }
}

function convertUnknownValue(dbgpProperty: DbgpProperty): RemoteObject {
  return {
    type: 'string',
    value: 'TODO: unknown: ' + JSON.stringify(dbgpProperty),
  };
}

function toBool(value: string): mixed {
  switch (value) {
    case '0':
      return false;
    case '1':
      return true;
    default:
      return 'Unexpected bool value: ' + value;
  }
}
