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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import nuclideUri from 'nuclide-commons/nuclideUri';
import typeof * as AdbService from './AdbService';

import * as AdbServiceLocal from './AdbService';
import nullthrows from 'nullthrows';

let rpcService: ?nuclide$RpcService;
atom.packages.serviceHub.consume('nuclide-rpc-services', '0.0.0', provider => {
  rpcService = provider;
});

export function getAdbServiceByNuclideUri(uri: NuclideUri): AdbService {
  if (rpcService == null && !nuclideUri.isRemote(uri)) {
    return AdbServiceLocal;
  }
  // nuclide-rpc-services should be available at this point.
  // If it isn't, throw an error.
  return nullthrows(rpcService).getServiceByNuclideUri('AdbService', uri);
}
