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

export type ProjectionistRules = {
  [fileGlob: string]: Projection | ProjectionistRules,
};

export type Projection = {
  alternate?: string | Array<string>,
  console?: string,
  dispatch?: string,
  // This is not supported by vim-projectionist but does not conflict with it.
  exclude?: string | Array<string>,
  make?: string,
  path?: string,
  start?: string,
  template?: string,
  type?: string,
  [string]: string,
};
