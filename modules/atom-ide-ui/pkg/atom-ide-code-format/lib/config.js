/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
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
