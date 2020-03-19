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

import type {ServerID, WorkerID} from './utils';

export opaque type Socket = any;

export type IPCServer = {
  start: () => void,
  stop: () => void,
  on: (WorkerID, (message: string, Socket) => void) => void,
  emit: (Socket, WorkerID, message: string) => void,
};

import ipc from 'node-ipc';

let started = false;

export const startServer = ({
  serverID,
}: {
  serverID: ServerID,
}): Promise<IPCServer> => {
  if (started) {
    throw new Error('IPC server can only be started once');
  }
  return new Promise(resolve => {
    started = true;
    ipc.config.id = serverID;
    ipc.config.retry = 1500;
    ipc.config.silent = true;

    ipc.serve(() => {
      resolve(ipc.server);
    });

    ipc.server.start();
  });
};
