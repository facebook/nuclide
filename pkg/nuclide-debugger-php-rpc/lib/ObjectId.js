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

import type {RemoteObjectId} from '../../nuclide-debugger-base/lib/protocol-types';

import invariant from 'assert';

/*
 * An ElementRange identifies a range of child elements of a data value.
 * startIndex represents the index of the first element in the range.
 * count the number of elements in the range.
 * pagesize is always the debuggee pagesize which currently defaults to 32.
 *
 * Note that the children of an ElementRange may be aggregated into ranges whose size
 * is larger than the debuggeee pagesize. For example given a range with pagesize
 * of 32, and count of 32^5, the children of the range will have a pagesize of 32
 * and count of 32^4.
 */
type ElementRange = {
  pagesize: number,
  startIndex: number,
  count: number,
};

/*
 * ObjectIds identify data values with children.
 *
 * Initially when data with children is returned to the Chrome
 * debugger only the ObjectId is returned. Subsequent calls by the debugger can request
 * the child properties of an ObjectId.
 *
 * There are 3 valid forms of ObjectId.
 *
 * ObjectIds for stack frame contexts just have the 3 required fields.
 * Contexts are never paged - even with large numbers of variables.
 *
 * Array and Object children may be paged.
 *
 * SinglePageObjectIds have fullname and page set. They represent a single page of
 * children of the value represented by fullname.
 *
 * PagedObjectIds have fullname and elementRange set. They represent multiple pages
 * of children of the value represented by fullname. Note that the children of
 * PagedObjectIds may be a combination of SinglePageObjectIds and PagedObjectIds.
 */
export type ObjectId = {
  enableCount: number,
  frameIndex: number,
  contextId: string,
  fullname?: string,
  page?: number,
  elementRange?: ElementRange,
};

const WATCH_CONTEXT_ID = 'Watch Context Id';

export function getWatchContextObjectId(
  enableCount: number,
  frameIndex: number,
): ObjectId {
  return createContextObjectId(enableCount, frameIndex, WATCH_CONTEXT_ID);
}

export function remoteObjectIdOfObjectId(id: ObjectId): RemoteObjectId {
  return JSON.stringify(id);
}

export function createContextObjectId(
  enableCount: number,
  frameIndex: number,
  contextId: string,
): ObjectId {
  return {
    enableCount,
    frameIndex,
    contextId,
  };
}

export function pagedObjectId(
  objectId: ObjectId,
  fullname: string,
  elementRange: ElementRange,
): ObjectId {
  const result = copyObjectId(objectId);
  result.fullname = fullname;
  result.elementRange = elementRange;

  return result;
}

export function singlePageObjectId(
  objectId: ObjectId,
  fullname: string,
  page: number,
): ObjectId {
  const result = copyObjectId(objectId);
  result.fullname = fullname;
  result.page = page;

  return result;
}

export function isWatchContextObjectId(id: ObjectId): boolean {
  return id.contextId === WATCH_CONTEXT_ID;
}

export function isContextObjectId(id: ObjectId): boolean {
  return !id.hasOwnProperty('fullname');
}

export function isSinglePageObjectId(id: ObjectId): boolean {
  return id.hasOwnProperty('page');
}

export function isPagedObjectId(id: ObjectId): boolean {
  return id.hasOwnProperty('elementRange');
}

/**
 * Extracts just the shared parts from an ObjectId. Does not use object.assign as objectId
 * may have fields which we must not copy.
 */
export function copyObjectId(id: ObjectId): ObjectId {
  return createContextObjectId(id.enableCount, id.frameIndex, id.contextId);
}

export function endIndexOfElementRange(elementRange: ElementRange): number {
  return elementRange.startIndex + elementRange.count;
}

export function endIndexOfObjectId(id: ObjectId): number {
  invariant(id.elementRange);
  return endIndexOfElementRange(id.elementRange);
}

export function startIndexOfObjectId(id: ObjectId, pagesize: number): number {
  if (isSinglePageObjectId(id)) {
    invariant(id.page != null);
    return id.page * pagesize;
  } else {
    invariant(id.elementRange);
    return id.elementRange.startIndex;
  }
}

export function countOfObjectId(
  id: ObjectId,
  pagesize: number,
  parentEndIndex: number,
): number {
  if (isSinglePageObjectId(id)) {
    return Math.min(
      pagesize,
      parentEndIndex - startIndexOfObjectId(id, pagesize),
    );
  } else {
    invariant(id.elementRange);
    return id.elementRange.count;
  }
}

/*
 * Given a PagedObjectId, return an array of ObjectIds for its children.
 * Note that the children may be a combination of PagedObjectIds and SinglePageObjectIds.
 */
export function getChildIds(id: ObjectId): Array<ObjectId> {
  invariant(id.elementRange);
  const pagesize = id.elementRange.pagesize;

  // Handle a page of pages (... of pages)
  let childSize = pagesize;
  while (childSize * pagesize < id.elementRange.count) {
    childSize *= pagesize;
  }

  const result = [];
  let childStartIndex = id.elementRange.startIndex;
  const endIndex = endIndexOfObjectId(id);
  while (childStartIndex < endIndex) {
    const childCount = Math.min(childSize, endIndex - childStartIndex);

    let childId;
    invariant(id.fullname != null);
    if (childCount <= pagesize) {
      childId = singlePageObjectId(
        id,
        id.fullname,
        Math.trunc(childStartIndex / pagesize),
      );
    } else {
      childId = pagedObjectId(id, id.fullname, {
        pagesize,
        startIndex: childStartIndex,
        count: childCount,
      });
    }

    result.push(childId);

    childStartIndex += childCount;
  }

  return result;
}
