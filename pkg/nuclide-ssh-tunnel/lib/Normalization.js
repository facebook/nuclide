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

import type {Tunnel, ResolvedTunnel} from 'nuclide-adb/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import typeof * as SocketService from '../../nuclide-socket-rpc';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {getSocketServiceByNuclideUri} from '../../nuclide-remote-connection';
import * as SocketServiceImpl from '../../nuclide-socket-rpc';

// Normalize host URIs
export async function resolveTunnel(tunnel: Tunnel): Promise<ResolvedTunnel> {
  const {from, to} = tunnel;
  const fromHost = getSharedHostUri(from.host);
  let fromPort;
  if (from.port === 'any_available') {
    fromPort = await getSocketServiceByHost(fromHost).getAvailableServerPort();
  } else {
    fromPort = from.port;
  }
  return {
    from: {
      host: getSharedHostUri(from.host),
      port: fromPort,
      family: from.family || 6,
    },
    to: {
      host: getSharedHostUri(to.host),
      port: to.port,
      family: to.family || 6,
    },
  };
}

// From tunneling perspective, host is a "singleton", all roots can reuse the same socket service.
export function getSharedHostUri(
  host: 'localhost' | NuclideUri | string,
): 'localhost' | NuclideUri {
  if (host === 'localhost' || host === '') {
    return 'localhost';
  } else if (nuclideUri.isRemote(host)) {
    return nuclideUri.createRemoteUri(nuclideUri.getHostname(host), '/');
  } else {
    // We assume that the passed string is a hostname.
    return nuclideUri.createRemoteUri(host, '/');
  }
}

// We assume `host`  has already been processed by getSharedHostUri
export function getSocketServiceByHost(
  host: 'localhost' | NuclideUri,
): SocketService {
  if (host === 'localhost') {
    // Bypass the RPC framework to avoid extra marshal/unmarshaling.
    return SocketServiceImpl;
  } else {
    return getSocketServiceByNuclideUri(host);
  }
}
