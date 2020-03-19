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
 * This is a map of common aliases. When a key in this map is used in a way
 * that would cause it to be required, the value is the module that is required
 * rather than the key.
 */
export default (new Map([['Immutable', 'immutable'], ['fbt', 'fbt']]): Map<
  string,
  string,
>);
