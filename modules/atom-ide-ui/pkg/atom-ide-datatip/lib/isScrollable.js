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

export default function isScrollable(
  element: Element,
  wheelEvent: WheelEvent,
): boolean {
  let node: ?Element = ((wheelEvent.target: any): Element);
  while (node != null && node !== element) {
    if (
      node.scrollHeight > node.clientHeight ||
      node.scrollWidth > node.clientWidth
    ) {
      return true;
    }
    node = ((node.parentNode: any): Element);
  }
  return false;
}
