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

import type {ThriftServiceConfig} from '../../services/thrift/types';

import ThriftPtyService from './gen-nodejs/ThriftPtyService';

export const PTY_SERVICE_CONFIG: ThriftServiceConfig = {
  name: 'thrift-pty',
  remoteUri: '',
  remoteCommand: 'node',
  remoteCommandArgs: [
    '{BIG_DIG_SERVICES_PATH}/src/thrift-services/pty/launchThriftPtyServer-entry.js',
    '{IPC_PATH}',
  ],
  remoteConnection: {type: 'ipcSocket', path: ''},
  thriftTransport: 'buffered',
  thriftProtocol: 'binary',
  thriftService: ThriftPtyService,
  killOldThriftServerProcess: true,
};
