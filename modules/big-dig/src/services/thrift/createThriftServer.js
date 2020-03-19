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

import type {ThriftServerConfig, ThriftServer} from './types';

import {startThriftServer} from './startThriftServer';

export async function createThriftServer(
  serverConfig: ThriftServerConfig,
): Promise<ThriftServer> {
  const thriftServerStream = startThriftServer(serverConfig);
  const thriftServerPromise = thriftServerStream.take(1).toPromise();
  const subscription = thriftServerStream.connect();

  const connectionOptions = await thriftServerPromise;
  return {
    getConnectionOptions: () => connectionOptions,
    close: () => subscription.unsubscribe(),
  };
}
