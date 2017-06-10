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
import {getLogger} from 'log4js';

const DEBUGGER_LOGGER_CATEGORY = 'nuclide-node-debugger';
export default getLogger(DEBUGGER_LOGGER_CATEGORY);

export function getConfig(): any {
  return (featureConfig.get('nuclide-debugger-node'): any);
}
