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

import type {MerlinCases} from '../../nuclide-ocaml-rpc';

import {Range} from 'atom';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';

export async function cases(
  editor: atom$TextEditor,
  position: atom$Point,
): Promise<void> {
  const path = editor.getPath();
  if (path == null) {
    return;
  }
  const instance = getServiceByNuclideUri('MerlinService', path);
  if (instance == null) {
    return;
  }
  await instance.pushNewBuffer(path, editor.getText());
  const casesResult: ?MerlinCases = await instance.cases(
    path,
    position,
    position,
  );
  if (casesResult == null) {
    return;
  }
  const [{start, end}, content] = casesResult;

  editor
    .getBuffer()
    .setTextInRange(
      new Range([start.line - 1, start.col], [end.line - 1, end.col]),
      content,
    );
}
