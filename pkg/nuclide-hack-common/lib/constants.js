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

/**
 * Constants here represent enums with the same values got from hh_client.
 */
export const HACK_GRAMMARS = ['text.html.hack', 'text.html.php'];

export type SearchResultTypeValue = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export const SearchResultType = Object.freeze({
  CLASS: 0,
  TYPEDEF: 1,
  METHOD: 2,
  CLASS_VAR: 3,
  FUNCTION: 4,
  CONSTANT: 5,
  INTERFACE: 6,
  ABSTRACT_CLASS: 7,
  TRAIT: 8,
});

export const HACK_WORD_REGEX = /[a-zA-Z0-9_$]+/g;
