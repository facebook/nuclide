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

import invariant from 'assert';
import fs from 'fs';
import {Observable} from 'rxjs';
import {IpcClientTransport} from './IpcTransports';
import {ServerConnection} from './ServerConnection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {fork, spawn, getOriginalEnvironment} from 'nuclide-commons/process';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {__DEV__} from 'nuclide-commons/runtime-info';
import {getAvailableServerPort} from 'nuclide-commons/serverPort';
import servicesConfig from '../../nuclide-server/lib/servicesConfig';
import {RpcConnection} from '../../nuclide-rpc';
import {getClientSideLoopbackMarshalers} from '../../nuclide-marshalers-client';

// This code may be executed before the config has been loaded!
// getWithDefaults is necessary to make sure that the default is 'true'.
// (But not in tests, as it's slow to start it up every time.)
// We disable this on Windows until fork gets fixed.
const useLocalRpc =
  Boolean(featureConfig.getWithDefaults('useLocalRpc', !atom.inSpecMode())) &&
  process.platform !== 'win32';
let localRpcClient: ?RpcConnection<Transport> = null;

// Creates a local RPC client that connects to a separate process.
function createLocalRpcClient(): RpcConnection<Transport> {
  // The Electron Node process won't support --inspect until v1.7.x.
  // In the meantime, try to find a more standard Node process.
  const fbNodeRun = nuclideUri.join(
    __dirname,
    '../../commons-node/fb-node-run.sh',
  );
  const spawnOptions = {
    killTreeWhenDone: true,
    stdio: ['pipe', 'pipe', 'pipe', 'pipe', 'ipc'],
  };
  // We cannot synchronously spawn the process here due to the shell environment.
  // process.js will wait for Atom's shell environment to become ready.
  const localServerProcess =
    __DEV__ && fs.existsSync(fbNodeRun) && process.platform !== 'win32'
      ? Observable.defer(() =>
          Promise.all([getAvailableServerPort(), getOriginalEnvironment()]),
        )
          .do(([port]) => {
            // eslint-disable-next-line no-console
            console.log(`Starting local RPC process with --inspect=${port}`);
          })
          .switchMap(([port, env]) =>
            spawn(
              fbNodeRun,
              [
                'node',
                // Electron v1.7.x will also allow --inspect=0.
                `--inspect=${port}`,
                '--require',
                require.resolve('../../commons-node/load-transpiler'),
                require.resolve('./LocalRpcServer'),
              ],
              spawnOptions,
            ),
          )
      : fork(
          '--require',
          [
            require.resolve('../../commons-node/load-transpiler'),
            require.resolve('./LocalRpcServer'),
          ],
          spawnOptions,
        );

  const transport = new IpcClientTransport(localServerProcess);
  return RpcConnection.createLocal(
    transport,
    getClientSideLoopbackMarshalers,
    servicesConfig,
  );
}

export function getlocalService(serviceName: string): Object {
  if (useLocalRpc) {
    if (localRpcClient == null) {
      localRpcClient = createLocalRpcClient();
    }
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
 * Asynchronously create or get a cached service.
 * @param uri It could either be either a local path or a remote path in form of
 *    `nuclide://$host/$path`. The function will use the $host from remote path to
 *    create a remote service or create a local service if the uri is local path.
 */
export function awaitServiceByNuclideUri(
  serviceName: string,
  uri: ?NuclideUri = null,
): Promise<?any> {
  const hostname = nuclideUri.getHostnameOpt(uri);
  return awaitService(serviceName, hostname);
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
  if (hostname != null && hostname !== '') {
    const serverConnection = ServerConnection.getByHostname(hostname);
    if (serverConnection == null) {
      return null;
    }
    return serverConnection.getService(serviceName);
  } else {
    return getlocalService(serviceName);
  }
}

/**
 * Asynchronously create or get a cached service. If hostname is null or empty
 * string, it returns a local service, otherwise a remote service will be returned.
 */
export function awaitService(
  serviceName: string,
  hostname: ?string,
): Promise<?Object> {
  if (hostname != null && hostname !== '') {
    return ServerConnection.connectionAddedToHost(hostname)
      .first()
      .toPromise()
      .then(serverConnection => serverConnection.getService(serviceName));
  } else {
    return Promise.resolve(getlocalService(serviceName));
  }
}
