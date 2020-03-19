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

/* eslint-disable nuclide-internal/prefer-nuclide-uri */

import type {TestResult, ProjectConfig, GlobalConfig} from './types';
export opaque type IPCID = string; // server id and worker id merged into one string
export opaque type WorkerID = string;
export opaque type ServerID = string;

import path from 'path';
import {formatExecError} from 'jest-message-util';

const IPC_IDS_SEPARATOR = '_';

export const rand = () => Math.floor(Math.random() * 10000000);

export const makeUniqServerId = (): ServerID =>
  `jest-atom-runner-ipc-server-${Date.now() + rand()}`;

export const makeUniqWorkerId = (): WorkerID =>
  `jest-atom-runner-ipc-worker-${Date.now() + rand()}`;

export const mergeIPCIDs = ({
  serverID,
  workerID,
}: {
  serverID: ServerID,
  workerID: WorkerID,
}) => `${serverID}${IPC_IDS_SEPARATOR}${workerID}`;

export const parseIPCIDs = (mergedIDs: IPCID) => {
  const [serverID, workerID] = mergedIDs.split(IPC_IDS_SEPARATOR);
  return {serverID, workerID};
};

// The only way atom allows us to pass data to it is in the form of a file path.
// So we pass a non-existing file path to it that encodes server and worker IDs,
// that we later parse and use to communicate back with the parent process.
export const extractIPCIDsFromFilePath = (
  passedFilePath: string,
): {serverID: ServerID, workerID: WorkerID} => {
  const {serverID, workerID} = parseIPCIDs(path.basename(passedFilePath));
  return {serverID, workerID};
};

export const MESSAGE_TYPES = Object.freeze({
  INITIALIZE: 'INITIALIZE',
  DATA: 'DATA',
  RUN_TEST: 'RUN_TEST',
  TEST_RESULT: 'TEST_RESULT',
  TEST_FAILURE: 'TEST_FAILURE',
  SHUT_DOWN: 'SHUT_DOWN',
});

export type MessageType = $Values<typeof MESSAGE_TYPES>;

export const parseJSON = (str: ?string): Object => {
  if (str == null) {
    throw new Error('String needs to be passed when parsing JSON');
  }
  let data;
  try {
    data = JSON.parse(str);
  } catch (error) {
    throw new Error(`Can't parse JSON: ${str}`);
  }

  return data;
};

export const makeMessage = ({
  messageType,
  data,
}: {
  messageType: MessageType,
  data?: string,
}) => `${messageType}-${data || ''}`;

export const parseMessage = (message: string) => {
  const messageType: messageType = Object.values(MESSAGE_TYPES).find(msgType =>
    message.startsWith((msgType: any)),
  );
  if (!messageType) {
    throw new Error(`IPC message of unknown type. Message must start from one of the following strings representing types followed by "-'.
         known types: ${JSON.stringify(MESSAGE_TYPES)}`);
  }

  return {messageType, data: message.slice(messageType.length + 1)};
};

export const buildFailureTestResult = (
  testPath: string,
  err: Error,
  config: ProjectConfig,
  globalConfig: GlobalConfig,
): TestResult => {
  const failureMessage = formatExecError(err, config, globalConfig);
  return {
    console: null,
    displayName: '',
    failureMessage,
    leaks: false,
    numFailingTests: 0,
    numPassingTests: 0,
    numPendingTests: 0,
    perfStats: {
      end: 0,
      start: 0,
    },
    skipped: false,
    snapshot: {
      added: 0,
      fileDeleted: false,
      matched: 0,
      unchecked: 0,
      uncheckedKeys: [],
      unmatched: 0,
      updated: 0,
    },
    sourceMaps: {},
    testExecError: failureMessage,
    testFilePath: testPath,
    testResults: [],
  };
};

export default {
  rand,
  makeUniqServerId,
  makeUniqWorkerId,
  extractIPCIDsFromFilePath,
  mergeIPCIDs,
  parseMessage,
  makeMessage,
  MESSAGE_TYPES,
  parseJSON,
  buildFailureTestResult,
};
