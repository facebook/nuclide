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

import type {Level} from '../../nuclide-console/lib/types';

type Parsed = {
  text: string,
  level: ?Level,
  tags: Array<string>,
};

const TAG_RE = /\[([^[\]]*)]/g;
const TAG_PATTERN = '\\[[^\\[\\]]*\\]'; // The same as TAG_RE but without capturing, for embedding.
const DATETIME_PATTERN = '\\d{4}-\\d{2}-\\d{2} \\d+:\\d+:\\d+\\.\\d+';
const PARTS_PATTERN = `${DATETIME_PATTERN}( (?:${TAG_PATTERN})+ ?)?([\\s\\S]*)`;
const PARTS_RE = new RegExp(PARTS_PATTERN);

export function parseMessageText(raw: string): Parsed {
  const messageMatch = raw.match(PARTS_RE);

  if (messageMatch == null) {
    return {
      text: raw,
      level: null,
      tags: [],
    };
  }

  const [, tagsPart, text] = messageMatch;
  const tags = [];
  let level;
  let tagMatch;
  while ((tagMatch = TAG_RE.exec(tagsPart))) {
    const tag = tagMatch[1];
    switch (tag) {
      case 'info':
      case 'log':
      case 'error':
      case 'debug':
        level = tag;
        break;
      case 'warn':
        level = 'warning';
        break;
      default:
        if (tag !== '') {
          tags.push(tag);
        }
    }
  }

  return {text, level, tags};
}
