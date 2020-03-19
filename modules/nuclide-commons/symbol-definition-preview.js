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

import type {NuclideUri} from './nuclideUri';
import mimeTypes from 'mime-types';
import fsPromise from './fsPromise';
import {countOccurrences} from './string';
import nuclideUri from './nuclideUri';

type Definition = {
  path: NuclideUri,
  position: atom$Point,
};

const MAX_PREVIEW_LINES = 10;
const MAX_FILESIZE = 100000;
const WHITESPACE_REGEX = /^\s*/;
function getIndentLevel(line: string) {
  // $FlowFixMe (>= v0.75.0)
  const match: RegExp$matchResult = WHITESPACE_REGEX.exec(line);
  return match[0].length;
}

export async function getDefinitionPreview(
  definition: Definition,
): Promise<?{
  mime: string,
  contents: string,
  encoding: string,
}> {
  // ensure filesize not too big before reading in whole file
  const stats = await fsPromise.stat(definition.path);
  if (stats.size > MAX_FILESIZE) {
    return null;
  }

  // if file is image, return base-64 encoded contents
  const fileBuffer = await fsPromise.readFile(definition.path);

  const mime =
    mimeTypes.contentType(nuclideUri.extname(definition.path)) || 'text/plain';
  if (mime.startsWith('image/')) {
    return {mime, contents: fileBuffer.toString('base64'), encoding: 'base64'};
  }

  const contents = fileBuffer.toString('utf8');
  const lines = contents.split('\n');

  const start = definition.position.row;
  const initialIndentLevel = getIndentLevel(lines[start]);

  const buffer = [];
  for (
    let i = start,
      openParenCount = 0,
      closedParenCount = 0,
      openCurlyCount = 0,
      closedCurlyCount = 0;
    i < start + MAX_PREVIEW_LINES && i < lines.length;
    i++
  ) {
    const line = lines[i];
    const indentLevel = getIndentLevel(line);
    openParenCount += countOccurrences(line, '(');
    closedParenCount += countOccurrences(line, ')');
    openCurlyCount += countOccurrences(line, '{');
    closedCurlyCount += countOccurrences(line, '}');

    buffer.push(line.substr(Math.min(indentLevel, initialIndentLevel))); // dedent

    // heuristic for the end of a function signature:
    if (indentLevel <= initialIndentLevel) {
      // we've returned back to the original indentation level
      if (openParenCount > 0 && openParenCount === closedParenCount) {
        // if we're in a fn definition, make sure we have balanced pairs of parens
        break;
      } else if (line.trim().endsWith(';')) {
        // c-style statement ending
        break;
      } else if (
        // end of a property definition
        line.trim().endsWith(',') &&
        // including complex types as values
        openCurlyCount === closedCurlyCount &&
        // but still not before function signatures are closed
        openParenCount === closedParenCount
      ) {
        break;
      }
    }
  }

  return {mime, contents: buffer.join('\n'), encoding: 'utf8'};
}
