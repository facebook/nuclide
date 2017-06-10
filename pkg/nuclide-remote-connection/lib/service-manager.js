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
import type {Transport} from '../../nuclide-rpc';

import {ServerConnection} from './ServerConnection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import invariant from 'assert';
import servicesConfig from '../../nuclide-server/lib/servicesConfig';
import {
  LoopbackTransports,
  ServiceRegistry,
  RpcConnection,
} from '../../nuclide-rpc';
import {isRunningInTest} from '../../commons-node/system-info';
import {getServerSideMarshalers} from '../../nuclide-marshalers-common';
import {getAtomSideLoopbackMarshalers} from '../../nuclide-marshalers-atom';

let localRpcClient: ?RpcConnection<Transport> = null;
let knownLocalRpc = false;

// Creates a local RPC client that we can use to ensure that
// local service calls have the same behavior as remote RPC calls.
function createLocalRpcClient(): RpcConnection<Transport> {
  const localTransports = new LoopbackTransports();
  const serviceRegistry = new ServiceRegistry(
    getServerSideMarshalers,
    servicesConfig,
  );
  const localClientConnection = RpcConnection.createServer(
    serviceRegistry,
    localTransports.serverTransport,
  );
  invariant(localClientConnection != null); // silence lint...
  return RpcConnection.createLocal(
    localTransports.clientTransport,
    getAtomSideLoopbackMarshalers,
    servicesConfig,
  );
}

export function setUseLocalRpc(value: boolean): void {
  invariant(!knownLocalRpc, 'setUseLocalRpc must be called exactly once');
  knownLocalRpc = true;
  if (value) {
    localRpcClient = createLocalRpcClient();
  }
}

export function getlocalService(serviceName: string): Object {
  invariant(
    knownLocalRpc || isRunningInTest(),
    'Must call setUseLocalRpc before getService',
  );
  if (localRpcClient != null) {
    return localRpcClient.getService(serviceName);
  } else {
    const [serviceConfig] = servicesConfig.filter(
      config => config.name === serviceName,
    );
    invariant(serviceConfig, `No config found for service ${serviceName}`);
    // $FlowIgnore
    return require(serviceConfig.implementation);
  }
}

/**
 * Create or get a cached service.
 * @param uri It could either be either a local path or a remote path in form of
 *    `nuclide://$host/$path`. The function will use the $host from remote path to
 *    create a remote service or create a local service if the uri is local path.
 */
export function getServiceByNuclideUri(
  serviceName: string,
  uri: ?NuclideUri = null,
): ?any {
  const hostname = nuclideUri.getHostnameOpt(uri);
  return getService(serviceName, hostname);
}

/**
 * Create or get cached service.
 * null connection implies get local service.
 */
export function getServiceByConnection(
  serviceName: string,
  connection: ?ServerConnection,
): Object {
  if (connection == null) {
    return getlocalService(serviceName);
  } else {
    return connection.getService(serviceName);
  }
}

/**
 * Create or get a cached service. If hostname is null or empty string,
 * it returns a local service, otherwise a remote service will be returned.
 */
export function getService(serviceName: string, hostname: ?string): ?Object {
  if (hostname) {
    const serverConnection = ServerConnection.getByHostname(hostname);
    if (serverConnection == null) {
      return null;
    }
    return serverConnection.getService(serviceName);
  } else {
    return getlocalService(serviceName);
  }
}
