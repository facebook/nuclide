/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import domPurify from 'dompurify'; // flowlint-line untyped-import:off

domPurify.addHook('beforeSanitizeElements', (node: ?Node) => {
  // Add newlines where we see `<p>` and `<br />` tags.
  if (node && node.nodeName === 'BR') {
    const parent = node.parentNode;
    if (parent != null) {
      parent.insertBefore(document.createTextNode('\n'), node);
    }
  }
  if (node && node.nodeName === 'P') {
    node.textContent = '\n' + node.textContent;
  }
});

/**
 * Sanitize a message for display in a notification. This removes HTML but also tries to be smart
 * about whitespace.
 */
export default function sanitizeHtml(
  message: string,
  options?: {
    condenseWhitespaces?: boolean,
  },
): string {
  // Remove the HTML.
  let withoutTags: string = domPurify.sanitize(message, {ALLOWED_TAGS: []});

  // Compress the whitespace.
  if (options?.condenseWhitespaces) {
    withoutTags = withoutTags
      .replace(/(?:\s*\n\s*)+/g, '\n')
      .replace(/[ \t]+/g, ' ');
  }

  return withoutTags.trim();
}
