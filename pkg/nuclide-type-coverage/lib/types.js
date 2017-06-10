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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {IconName} from 'nuclide-commons-ui/Icon';

import type {CoverageResult} from './rpc-types';

export interface CoverageProvider {
  getCoverage(path: NuclideUri): Promise<?CoverageResult>,
  priority: number,
  grammarScopes: Array<string>,
  displayName: string,
  icon?: IconName,
}
