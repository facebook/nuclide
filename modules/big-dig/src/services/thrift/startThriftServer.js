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

import type {ProcessMessage} from 'nuclide-commons/process';
import type {ThriftServerConfig, ConnectionOptions} from './types';

import escapeRegExp from 'escape-string-regexp';
import {getLogger} from 'log4js';
import {track} from 'nuclide-commons/analytics';
import fsPromise from 'nuclide-commons/fsPromise';
import {getAvailableServerPort} from 'nuclide-commons/serverPort';
import {ConnectableObservable, Observable} from 'rxjs';
import {observeProcess, psTree, killPid} from 'nuclide-commons/process';
import net from 'net';
import uuid from 'uuid';
import {genConfigId} from './config-utils';
import which from 'nuclide-commons/which';
import path from 'path';
// @fb-only: import {getEnv} from './fb-env';

const IPC_PATH_PLACEHOLDER = '{IPC_PATH}';
const PORT_PLACEHOLDER = '{PORT}';
const SERVICES_PATH_PLACEHOLDER = '{BIG_DIG_SERVICES_PATH}';

const logger = getLogger('thrift-service-server');
const cache: Map<string, Observable<ConnectionOptions>> = new Map();

export function startThriftServer(
  serverConfig: ThriftServerConfig,
): ConnectableObservable<ConnectionOptions> {
  return Observable.defer(() => {
    const configId = genConfigId(serverConfig);
    let thriftServer = cache.get(configId);
    if (thriftServer == null) {
      const logTag = `${serverConfig.name}-${uuid.v4()}`;
      logger.info('Starting Thrift Server', logTag, serverConfig);
      thriftServer = Observable.defer(() => replacePlaceholders(serverConfig))
        .switchMap(config => mayKillOldServerProcess(config).map(_ => config))
        .switchMap(config =>
          Observable.merge(
            observeServerProcess(config)
              .do(logProcessMessage(logTag))
              .ignoreElements(),
            observeServerStatus(config).do(() =>
              logger.info(logTag, 'Thrift Server is ready', config),
            ),
          ).map(_ => getConnectionOptions(config)),
        )
        .finally(() => {
          cache.delete(configId);
          logger.info('Thrift Server has been closed ', configId);
        })
        .publishReplay(1)
        .refCount();

      cache.set(configId, thriftServer);
    }
    return thriftServer;
  }).publish();
}

async function replacePlaceholders(
  serverConfig: ThriftServerConfig,
): Promise<ThriftServerConfig> {
  const replaceBigDigServicesPath = value =>
    value.replace(SERVICES_PATH_PLACEHOLDER, path.join(__dirname, '../../../'));
  const remoteCommand = replaceBigDigServicesPath(serverConfig.remoteCommand);
  const remoteCommandArgs = serverConfig.remoteCommandArgs.map(
    replaceBigDigServicesPath,
  );

  const hasValidCommand = (await which(remoteCommand)) != null;
  if (!hasValidCommand) {
    throw new Error(`Remote command is invalid: ${remoteCommand}`);
  }

  switch (serverConfig.remoteConnection.type) {
    case 'tcp':
      if (serverConfig.remoteConnection.port === 0) {
        const hasPlaceholderForPort =
          serverConfig.remoteCommandArgs.find(arg =>
            arg.includes(PORT_PLACEHOLDER),
          ) != null;
        if (!hasPlaceholderForPort) {
          throw new Error(
            `Expected placeholder "${PORT_PLACEHOLDER}" for remote port`,
          );
        }
        const remotePort = await getAvailableServerPort();
        return {
          ...serverConfig,
          remoteConnection: {
            type: 'tcp',
            port: remotePort,
          },
          remoteCommandArgs: remoteCommandArgs.map(arg =>
            arg.replace(PORT_PLACEHOLDER, String(remotePort)),
          ),
        };
      }
      break;
    case 'ipcSocket':
      if (serverConfig.remoteConnection.path.length === 0) {
        const hasPlaceholderForIpcPath =
          serverConfig.remoteCommandArgs.find(arg =>
            arg.includes(IPC_PATH_PLACEHOLDER),
          ) != null;
        if (!hasPlaceholderForIpcPath) {
          throw new Error(
            `Expected placeholder "${IPC_PATH_PLACEHOLDER}" for remote IPC socket path`,
          );
        }
        const ipcSocketPath = path.join(await fsPromise.tempdir(), 'socket');
        return {
          ...serverConfig,
          remoteConnection: {
            type: 'ipcSocket',
            path: ipcSocketPath,
          },
          remoteCommandArgs: remoteCommandArgs.map(arg =>
            arg.replace(IPC_PATH_PLACEHOLDER, String(ipcSocketPath)),
          ),
        };
      }
      break;
    default:
      (serverConfig.remoteConnection.type: empty);
      throw new Error('Invalid remote connection type');
  }
  return {
    ...serverConfig,
    remoteCommand,
    remoteCommandArgs,
  };
}

function mayKillOldServerProcess(config: ThriftServerConfig): Observable<void> {
  return Observable.defer(async () => {
    if (!config.killOldThriftServerProcess) {
      return;
    }
    const processes = await psTree();
    processes
      .filter(
        processInfo =>
          processInfo.commandWithArgs.search(
            `${escapeRegExp(config.remoteCommand)}.*${escapeRegExp(
              config.remoteCommandArgs.join(' '),
            )}`,
          ) > -1,
      )
      .forEach(processInfo => {
        logger.info(
          `Old ${genConfigId(config)} (pid ${processInfo.pid}) was killed`,
        );
        track('thrift-service-server:kill-server');
        killPid(processInfo.pid);
      });
  });
}

function observeServerProcess(
  config: ThriftServerConfig,
): Observable<ProcessMessage> {
  return observeProcess(config.remoteCommand, config.remoteCommandArgs, {
    isExitError: () => true,
    detached: false,
    killTreeWhenDone: true,
    // @fb-only: env: getEnv(),
    env: process.env, // @oss-only
  });
}

/**
 * Streams `true` when thrift server is listening in the given port.
 * If server is not ready, it tries to reconnects.
 */
function observeServerStatus(config: ThriftServerConfig): Observable<true> {
  const maxAttempts = 10;
  return Observable.create(observer => {
    let ready = false;
    const client = net
      .connect(
        // $FlowIgnore
        getConnectionOptions(config),
      )
      .on('connect', () => {
        client.destroy();
        ready = true;
        observer.next(ready);
      })
      .on('error', () => {
        client.destroy();
        if (!ready) {
          observer.error(
            new Error('Occurred an error when connecting to the thrift server'),
          );
        }
      })
      .once('close', () => {
        if (!ready) {
          observer.error(
            new Error('Connection closed but server is not ready'),
          );
        }
      });
  }).retryWhen(throwOrRetry(maxAttempts));
}

function throwOrRetry(
  maxAttempts: number,
): (errorStream: Observable<Error>) => Observable<number> {
  return errorStream =>
    errorStream.switchMap((error, i) => {
      const attempt = i + 1;
      if (attempt > maxAttempts) {
        throw error;
      }
      logger.error(
        `(${attempt}/${maxAttempts}) Retrying to connect to thrift server after error `,
        error,
      );
      return Observable.timer(attempt * 1000);
    });
}

function logProcessMessage(name: string): ProcessMessage => void {
  return message => {
    switch (message.kind) {
      case 'stdout':
        logger.info(`(${name}) `, message.data);
        return;
      case 'stderr':
        if (message.data.includes('[ERROR]')) {
          logger.error(`(${name}) `, message.data);
        } else {
          logger.info(`(${name}) `, message.data);
        }
        return;
      case 'exit':
        logger.info(`(${name}) `, 'Exited with code ', message.exitCode);
        return;
    }
  };
}

function getConnectionOptions(config: ThriftServerConfig): ConnectionOptions {
  switch (config.remoteConnection.type) {
    case 'tcp':
      return {port: config.remoteConnection.port, useIPv4: false};
    case 'ipcSocket':
      return {path: config.remoteConnection.path};
    default:
      (config.remoteConnection.type: empty);
      throw new Error('Invalid remote connection type');
  }
}
