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
import pollFor from './pollFor';

export async function fileTreeHasFinishedLoading(
  maxWaitTime: number = 1000,
): Promise<void> {
  await pollFor(
    () => {
      const cssSelector =
        '.nuclide-file-tree .list-tree.has-collapsable-children .loading';
      invariant(document.body != null);
      return document.body.querySelectorAll(cssSelector).length === 0;
    },
    'File tree did not finish loading',
    maxWaitTime,
  );
}

export function getVisibleEntryFromFileTree(name: string): ?HTMLElement {
  const cssSelector =
    '.nuclide-file-tree .list-tree.has-collapsable-children li';
  invariant(document.body != null);
  const elements = Array.prototype.slice.call(
    document.body.querySelectorAll(cssSelector),
  );
  return elements.find(e => e.innerHTML.indexOf(`>${name}<`) > -1);
}
