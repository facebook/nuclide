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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import typeof * as VSCodeDebuggerAdapterService from './VSCodeDebuggerAdapterService';

import * as VSCodeDebuggerAdapterServiceLocal from './VSCodeDebuggerAdapterService';

export function getVSCodeDebuggerAdapterServiceByNuclideUri(
  uri: NuclideUri,
): VSCodeDebuggerAdapterService {
  let rpcService: ?nuclide$RpcService = null;
  // Atom's service hub is synchronous.
  atom.packages.serviceHub
    .consume('nuclide-rpc-services', '0.0.0', provider => {
      rpcService = provider;
    })
    .dispose();
  if (rpcService != null) {
    return rpcService.getServiceByNuclideUri(
      'VSCodeDebuggerAdapterService',
      uri,
    );
  } else {
    return VSCodeDebuggerAdapterServiceLocal;
  }
}
