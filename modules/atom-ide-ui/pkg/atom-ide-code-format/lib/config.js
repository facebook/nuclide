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

import featureConfig from 'nuclide-commons-atom/feature-config';

export function getFormatOnSave(): boolean {
  const formatOnSave = (featureConfig.get(
    'atom-ide-code-format.formatOnSave',
  ): any);
  return formatOnSave == null ? false : formatOnSave;
}

export function getFormatOnType(): boolean {
  return featureConfig.getWithDefaults(
    'atom-ide-code-format.formatOnType',
    false,
  );
}
