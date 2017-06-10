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

import type {HyperclickSuggestion} from 'atom-ide-ui';
import type {CtagsResult, CtagsService} from '../../nuclide-ctags-rpc';

import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import {getCtagsServiceByNuclideUri} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {CTAGS_KIND_NAMES, getLineNumberForTag} from './utils';

const LIMIT = 100;
const QUALIFYING_FIELDS = ['class', 'namespace', 'struct', 'enum', 'Module'];

/**
 * If a line number is specified by the tag, jump to that line.
 * Otherwise, we'll have to look up the pattern in the file.
 */
function createCallback(tag: CtagsResult) {
  return async () => {
    const lineNumber = await getLineNumberForTag(tag);
    goToLocation(tag.file, lineNumber, 0);
  };
}

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) {
    i++;
  }
  return i;
}

export default class HyperclickHelpers {
  static async getSuggestionForWord(
    textEditor: atom$TextEditor,
    text: string,
    range: atom$Range,
  ): Promise<?HyperclickSuggestion> {
    const path = textEditor.getPath();
    if (path == null) {
      return null;
    }

    const service = getCtagsServiceByNuclideUri(path);
    const ctagsService = (await service.getCtagsService(path): ?CtagsService);

    if (ctagsService == null) {
      return null;
    }

    try {
      const tags = await ctagsService.findTags(text, {limit: LIMIT});
      if (!tags.length) {
        return null;
      }

      if (tags.length === 1) {
        return {range, callback: createCallback(tags[0])};
      }

      // Favor tags in the nearest directory by sorting by common prefix length.
      tags.sort(({file: a}, {file: b}) => {
        const len = commonPrefixLength(path, b) - commonPrefixLength(path, a);
        if (len === 0) {
          return a.localeCompare(b);
        }
        return len;
      });

      const tagsDir = nuclideUri.dirname(await ctagsService.getTagsPath());
      return {
        range,
        callback: tags.map(tag => {
          const {file, fields, kind} = tag;
          const relpath = nuclideUri.relative(tagsDir, file);
          let title = `${tag.name} (${relpath})`;
          if (fields != null) {
            // Python uses a.b.c; most other langauges use a::b::c.
            // There are definitely other cases, but it's not a big issue.
            const sep = file.endsWith('.py') ? '.' : '::';
            for (const field of QUALIFYING_FIELDS) {
              const val = fields.get(field);
              if (val != null) {
                title = val + sep + title;
                break;
              }
            }
          }
          if (kind != null && CTAGS_KIND_NAMES[kind] != null) {
            title = CTAGS_KIND_NAMES[kind] + ' ' + title;
          }
          return {
            title,
            callback: createCallback(tag),
          };
        }),
      };
    } finally {
      ctagsService.dispose();
    }
  }
}
