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
 * These are all of the transforms that may be run via `transform`.
 */
export type TransformKey =
  | 'nuclide.fixHeader'
  | 'requires.transferComments'
  | 'requires.removeUnusedRequires'
  | 'requires.addMissingRequires'
  | 'requires.removeUnusedTypes'
  | 'requires.addMissingTypes'
  | 'requires.formatRequires';
