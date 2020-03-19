/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

// Mercurial history emails can be invalid.
const HG_EMAIL_REGEX = /\b([A-Za-z0-9._%+-]+)@[A-Za-z0-9.-]+\b/;

/**
 * `hg blame` may return the 'user' name in a mix of formats:
 *   - foo@bar.com
 *   - bar@56abc2-24378f
 *   - Foo Bar <foo@bar.com>
 * This method shortens the name in `blameName` to just
 * return the beginning part of the email, iff an email is present.
 * The examples above would become 'foo'.
 */
export function shortNameForAuthor(blameName: string): string {
  const match = blameName.match(HG_EMAIL_REGEX);
  // Index 0 will be the whole email. Index 1 is the capture group.
  return match ? match[1] : blameName;
}
