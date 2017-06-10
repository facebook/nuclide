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

import type {TypeHint} from './rpc-types';

export type TypeHintProvider = {
  typeHint(
    editor: atom$TextEditor,
    bufferPosition: atom$Point,
  ): Promise<?TypeHint>,
  inclusionPriority: number,
  selector: string,
  // A unique name for the provider to be used for analytics. It is recommended that it be the name
  // of the provider's package.
  providerName: string,
};
