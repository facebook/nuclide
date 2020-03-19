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

export async function getNodeBinaryPath(path: NuclideUri): Promise<string> {
  try {
    // $FlowFB
    return require('./fb-node-info').getNodeBinaryPath(path);
  } catch (error) {
    return 'node';
  }
}
