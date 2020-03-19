/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {GatekeeperService} from 'nuclide-commons-atom/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import nuclideUri from 'nuclide-commons/nuclideUri';
import typeof * as PtyService from './pty-service/PtyService';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as PtyServiceLocal from './pty-service/PtyService';
import nullthrows from 'nullthrows';

let _rpcService: ?nuclide$RpcService = null;
let _gkService: ?GatekeeperService = null;

export function setRpcService(rpcService: nuclide$RpcService): IDisposable {
  _rpcService = rpcService;
  return new UniversalDisposable(() => {
    _rpcService = null;
  });
}

export function setGkService(gkService: GatekeeperService): IDisposable {
  _gkService = gkService;
  return new UniversalDisposable(() => {
    _gkService = null;
  });
}

export function getGkService(): ?GatekeeperService {
  return _gkService;
}

export function getPtyServiceByNuclideUri(uri: ?NuclideUri): PtyService {
  const serviceUri = uri || '';
  if (_rpcService == null && !nuclideUri.isRemote(serviceUri)) {
    return PtyServiceLocal;
  }

  return nullthrows(_rpcService).getServiceByNuclideUri(
    'PtyService',
    serviceUri,
  );
}
