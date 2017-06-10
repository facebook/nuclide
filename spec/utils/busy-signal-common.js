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

function getElement(): HTMLElement {
  const element = atom.views
    .getView(atom.workspace)
    .querySelector('.nuclide-busy-signal-status-bar');
  invariant(element != null);
  return element;
}

export default {
  isBusy(): boolean {
    return getElement().classList.contains('loading-spinner-tiny');
  },
};
