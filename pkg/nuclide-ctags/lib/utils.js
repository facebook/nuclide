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

import type {CtagsResult} from '../../nuclide-ctags-rpc';

import {getLogger} from 'log4js';
import {
  getFileSystemServiceByNuclideUri,
} from '../../nuclide-remote-connection';

// Taken from http://ctags.sourceforge.net/FORMAT
export const CTAGS_KIND_NAMES = {
  c: 'class',
  d: 'define',
  e: 'enum',
  f: 'function',
  F: 'file',
  g: 'enum',
  m: 'member',
  p: 'function',
  s: 'struct',
  t: 'typedef',
  u: 'union',
  v: 'var',
};

export const CTAGS_KIND_ICONS = {
  c: 'icon-code',
  d: 'icon-quote',
  e: 'icon-quote',
  f: 'icon-zap',
  F: 'icon-file-binary',
  g: 'icon-quote',
  m: 'icon-zap',
  p: 'icon-zap',
  s: 'icon-code',
  t: 'icon-tag',
  u: 'icon-code',
  v: 'icon-code',
};

export async function getLineNumberForTag(tag: CtagsResult): Promise<number> {
  let {lineNumber, pattern} = tag;
  if (lineNumber) {
    lineNumber--; // ctags line numbers start at 1
  } else if (pattern != null) {
    // ctags does not escape regexps properly.
    // However, it should never create anything beyond /x/ or /^x$/.
    let exactMatch = false;
    if (pattern.startsWith('/') && pattern.endsWith('/')) {
      pattern = pattern.substr(1, pattern.length - 2);
      if (pattern.startsWith('^') && pattern.endsWith('$')) {
        pattern = pattern.substr(1, pattern.length - 2);
        exactMatch = true;
      }
    }
    try {
      // Search for the pattern in the file.
      const service = getFileSystemServiceByNuclideUri(tag.file);
      const contents = await service.readFile(tag.file);
      const lines = contents.toString('utf8').split('\n');
      lineNumber = 0;
      for (let i = 0; i < lines.length; i++) {
        if (
          exactMatch ? lines[i] === pattern : lines[i].indexOf(pattern) !== -1
        ) {
          lineNumber = i;
          break;
        }
      }
    } catch (e) {
      getLogger('nuclide-ctags').warn(
        `nuclide-ctags: Could not locate pattern in ${tag.file}`,
        e,
      );
    }
  }

  return lineNumber;
}
