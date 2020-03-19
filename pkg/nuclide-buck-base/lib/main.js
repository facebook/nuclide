/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import typeof * as BuckService from '../../nuclide-buck-rpc';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {getServiceByNuclideUri} from '../../nuclide-remote-connection';

const buckProjectDirectoryByPath: Map<string, string> = new Map();

export function isBuckFile(filePath: string): boolean {
  // TODO(mbolin): Buck does have an option where the user can customize the
  // name of the build file: https://github.com/facebook/buck/issues/238.
  // This function will not work for those who use that option.
  return nuclideUri.basename(filePath) === 'BUCK';
}

export function getBuckService(filePath: string): ?BuckService {
  return getServiceByNuclideUri('BuckService', filePath);
}

/**
 * Cached, service-aware version of BuckProject.getRootForPath.
 */
export async function getBuckProjectRoot(filePath: string): Promise<?string> {
  let directory = buckProjectDirectoryByPath.get(filePath);
  // flowlint-next-line sketchy-null-string:off
  if (!directory) {
    const service = getBuckService(filePath);
    if (service == null) {
      return null;
    }
    directory = await service.getRootForPath(filePath);
    if (directory == null) {
      return null;
    } else {
      buckProjectDirectoryByPath.set(filePath, directory);
    }
  }
  return directory;
}
