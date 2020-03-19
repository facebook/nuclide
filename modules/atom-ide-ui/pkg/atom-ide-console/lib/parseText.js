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

import * as React from 'react';
import featureConfig from 'nuclide-commons-atom/feature-config';

import {URL_REGEX} from 'nuclide-commons/string';
const DIFF_PATTERN = '\\b[dD][1-9][0-9]{5,}\\b';
const TASK_PATTERN = '\\b[tT]\\d+\\b';

/**
 * This does NOT contain a pattern to match file references. This is because file paths do not
 * contain sufficient information to locate a file. Consider `b/c/d.txt`. What is it relative to?
 * Only the thing that generated the message knows. Even absolute paths aren't enough. (Are they
 * local? Remote? Which host?) In addition, pattern matching filenames isn't reliable (`b.txt`,
 * `b.com`). The upshot is that "best guess" solutions add more confusion than convenience; a proper
 * solution probably requires both standardization on remote path (e.g. NuclideUris) and some
 * mechanism for message creators to mark up their messages with this information (e.g. `<a>`).
 */
const CLICKABLE_PATTERNS = `(${DIFF_PATTERN})|(${TASK_PATTERN})|(${
  URL_REGEX.source
})`;
const CLICKABLE_RE = new RegExp(CLICKABLE_PATTERNS, 'g');

function toString(value: mixed): string {
  return typeof value === 'string' ? value : '';
}

/**
 * Parse special entities into links. In the future, it would be great to add a service so that we
 * could add new clickable things and to allow providers to mark specific ranges as links to things
 * that only they can know (e.g. relative paths output in BUCK messages). For now, however, we'll
 * just use some pattern settings and hardcode the patterns we care about.
 */
export default function parseText(
  text: string,
): Array<string | React.Element<any>> {
  if (typeof text !== 'string') {
    return [];
  }
  const chunks = [];
  let lastIndex = 0;
  let index = 0;
  while (true) {
    const match = CLICKABLE_RE.exec(text);
    if (match == null) {
      break;
    }

    const matchedText = match[0];

    // Add all the text since our last match.
    chunks.push(
      text.slice(lastIndex, CLICKABLE_RE.lastIndex - matchedText.length),
    );
    lastIndex = CLICKABLE_RE.lastIndex;

    let href;
    let handleOnClick;
    if (match[1] != null) {
      // It's a diff
      const url = toString(
        featureConfig.get('atom-ide-console.diffUrlPattern'),
      );
      if (url !== '') {
        href = url.replace('%s', matchedText);
      }
    } else if (match[2] != null) {
      // It's a task
      const url = toString(
        featureConfig.get('atom-ide-console.taskUrlPattern'),
      );
      if (url !== '') {
        href = url.replace('%s', matchedText.slice(1));
      }
    } else if (match[3] != null) {
      // It's a URL
      href = matchedText;
    }

    chunks.push(
      // flowlint-next-line sketchy-null-string:off
      href ? (
        <a
          key={`r${index}`}
          href={href}
          target="_blank"
          onClick={handleOnClick}>
          {matchedText}
        </a>
      ) : (
        matchedText
      ),
    );

    index++;
  }

  // Add any remaining text.
  chunks.push(text.slice(lastIndex));

  return chunks;
}
