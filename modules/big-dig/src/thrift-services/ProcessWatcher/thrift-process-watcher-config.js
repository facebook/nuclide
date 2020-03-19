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

import type {ThriftServiceConfig} from '../../services/thrift/types';

// $FlowIgnore
import ThriftProcessWatcherService from './gen-nodejs/ThriftProcessWatcherService';

export const PROCESS_WATCHER_SERVICE_CONFIG: ThriftServiceConfig = {
  name: 'thrift-process-watcher',
  remoteUri: '',
  remoteCommand: 'node',
  remoteCommandArgs: [
    '{BIG_DIG_SERVICES_PATH}/src/thrift-services/ProcessWatcher/launchThriftProcessWatcherServer-entry.js',
    '{IPC_PATH}',
  ],
  remoteConnection: {type: 'ipcSocket', path: ''},
  thriftTransport: 'buffered',
  thriftProtocol: 'binary',
  thriftService: ThriftProcessWatcherService,
  killOldThriftServerProcess: true,
};
