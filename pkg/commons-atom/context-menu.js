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

import invariant from 'assert';
import {remote} from 'electron';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

/**
* Shows the provided menu template. This will result in [an extra call to `templateForEvent()`][1],
* but it means that we still go through `showMenuForEvent()`, maintaining its behavior wrt
* (a)synchronousness. See atom/atom#13398.
*
* [1]: https://github.com/atom/atom/blob/v1.13.0/src/context-menu-manager.coffee#L200
*/
export function showMenuForEvent(
  event: MouseEvent,
  menuTemplate: Array<Object>,
): UniversalDisposable {
  invariant(remote != null);
  const win = (remote.getCurrentWindow(): any);
  const originalEmit = win.emit;
  const restore = () => {
    win.emit = originalEmit;
  };
  win.emit = (eventType, ...args) => {
    if (eventType !== 'context-menu') {
      return originalEmit(eventType, ...args);
    }
    const result = originalEmit('context-menu', menuTemplate);
    restore();
    return result;
  };
  atom.contextMenu.showForEvent(event);
  return new UniversalDisposable(restore);
}
