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

export type IPCWorker = {
  onMessage((message: string) => void): void,
  send(message: string): void,
};

import ipc from 'node-ipc';
import {makeMessage, MESSAGE_TYPES} from './utils';

let connected = false;
export const connectToIPCServer = ({
  serverID,
  workerID,
}: {
  serverID: ServerID,
  workerID: WorkerID,
}): Promise<IPCWorker> => {
  if (connected) {
    throw new Error(
      "can't connect to IPC server more than once from one worker",
    );
  }
  connected = true;

  ipc.config.id = serverID;
  ipc.config.retry = 1500;

  return new Promise(resolve => {
    const onMessageCallbacks = [];
    ipc.connectTo(serverID, () => {
      ipc.of[serverID].on('connect', () => {
        const initMessage = makeMessage({
          messageType: MESSAGE_TYPES.INITIALIZE,
        });
        ipc.of[serverID].emit(workerID, initMessage);
      });

      ipc.of[serverID].on(workerID, data => {
        onMessageCallbacks.forEach(cb => cb(data));
      });

      resolve({
        send: message => ipc.of[serverID].emit(workerID, message),
        onMessage: fn => {
          onMessageCallbacks.push(fn);
        },
      });
    });
  });
};
