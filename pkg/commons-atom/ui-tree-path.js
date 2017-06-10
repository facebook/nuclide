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

const TREE_API_DATA_PATH = 'data-path';

import invariant from 'assert';

/**
 * This shouldn't be used for the `file-tree` as it's replaced by
 * the `FileTreeContextMenu` API.
 * This can only be useful for other `ui/tree` usages, like the `DiffViewTree`.
 */
export default function uiTreePath(
  event: Event | {currentTarget: EventTarget},
): ?string {
  // Event target isn't necessarily an HTMLElement,
  // but that's guaranteed in the usages here.
  const target: HTMLElement = (event.currentTarget: any);
  const nameElement = target.hasAttribute(TREE_API_DATA_PATH)
    ? target
    : target.querySelector(`[${TREE_API_DATA_PATH}]`);
  invariant(nameElement != null);
  return nameElement.getAttribute(TREE_API_DATA_PATH);
}
