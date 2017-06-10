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

import type {Outline} from 'atom-ide-ui';
import type {MerlinProcess} from '../../nuclide-ocaml-rpc/lib/MerlinProcess';

import {Point} from 'atom';

import {
  className,
  method,
  keyword,
  plain,
  type,
  whitespace,
} from 'nuclide-commons/tokenized-text';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';

function makeTokens(data) {
  let kind;
  let nameToken;

  switch (data.kind) {
    case 'Value':
      kind = 'val';
      nameToken = method(data.name);
      break;
    case 'Class':
    case 'Exn':
    case 'Module':
      nameToken = className(data.name);
      break;
    case 'Constructor':
      kind = 'ctor';
      nameToken = className(data.name);
      break;
    case 'Signature':
      kind = 'sig';
      nameToken = className(data.name);
      break;
    case 'Type':
      nameToken = type(data.name);
      break;
  }
  if (kind == null) {
    kind = data.kind.toLowerCase();
  }
  if (nameToken == null) {
    nameToken = plain(data.name);
  }

  return [keyword(kind), whitespace(' '), nameToken];
}

function convertMerlinOutlines(outlines) {
  return outlines
    .map(data => {
      const tokenizedText = makeTokens(data);
      const children = convertMerlinOutlines(data.children);
      const startPosition = new Point(data.start.line - 1, data.start.col);
      const endPosition = new Point(data.end.line - 1, data.end.col);

      return {
        tokenizedText,
        children,
        startPosition,
        endPosition,
      };
    })
    .sort((a, b) => {
      return a.startPosition.compare(b.startPosition);
    });
}

export async function getOutline(editor: atom$TextEditor): Promise<?Outline> {
  const path = editor.getPath();
  if (path == null) {
    return null;
  }
  const instance: ?MerlinProcess = getServiceByNuclideUri(
    'MerlinService',
    path,
  );
  if (!instance) {
    return null;
  }
  await instance.pushNewBuffer(path, editor.getText());
  const result = await instance.outline(path);
  if (!Array.isArray(result)) {
    return null;
  }
  return {
    outlineTrees: convertMerlinOutlines(result),
  };
}
