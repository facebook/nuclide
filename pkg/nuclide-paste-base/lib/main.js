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

export type PasteOptions = {
  language?: ?string,
  title?: ?string,
};

export type CreatePasteFunction = (
  message: string,
  options: PasteOptions,
  source: string,
) => Promise<string>;
