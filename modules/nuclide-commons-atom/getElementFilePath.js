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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {isValidTextEditor} from './text-editor';

export default function getElementFilePath(
  element: ?HTMLElement,
  fallbackToActiveTextEditor: boolean = false,
): ?NuclideUri {
  let el = element;
  while (el != null) {
    if (el.dataset != null && el.dataset.path != null) {
      return (el.dataset: any).path;
    }
    // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
    if (typeof el.getModel === 'function') {
      const model = el.getModel();
      if (isValidTextEditor(model)) {
        const path = model.getPath();
        if (path != null) {
          return path;
        }
      }
    }
    el = el.parentElement;
  }
  if (fallbackToActiveTextEditor) {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor != null) {
      return editor.getPath();
    }
  }
  return null;
}
