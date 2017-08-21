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

import type {Definition} from 'atom-ide-ui';

import {getDefinitionPreview as getDefinitionPreviewImpl} from 'nuclide-commons/symbol-definition-preview';

export function getDefinitionPreview(definition: Definition): Promise<string> {
  return getDefinitionPreviewImpl(definition);
}
