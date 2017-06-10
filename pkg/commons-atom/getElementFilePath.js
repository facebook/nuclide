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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {isValidTextEditor} from 'nuclide-commons-atom/text-editor';

export default function getElementFilePath(
  element: ?HTMLElement,
  fallbackToActiveTextEditor: boolean = false,
): ?NuclideUri {
  let el = element;
  while (el != null) {
    if (el.dataset != null && el.dataset.path != null) {
      return (el.dataset: any).path;
    }
    if (typeof el.getModel === 'function') {
      const model = el.getModel();
      if (isValidTextEditor(model)) {
        const path = ((model: any): atom$TextEditor).getPath();
        if (path != null) {
          return path;
        }
      }
    }
    el = el.parentElement;
  }
  if (fallbackToActiveTextEditor) {
    const editor = atom.workspace.getActiveTextEditor();
    if (editor != null && isValidTextEditor(editor)) {
      return editor.getPath();
    }
  }
  return null;
}
