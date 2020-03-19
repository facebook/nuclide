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

import type {BigDigServer} from '../../server/BigDigServer';
import type {Transport} from '../../server/BigDigServer';

import {ThriftServerManager} from './ThriftServerManager';

import {getLogger} from 'log4js';

const logger = getLogger('thrift-service');

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports = function launch(server: BigDigServer): Promise<void> {
  logger.info('adding Thrift Service subscriber!');

  server.addSubscriber('thrift-services', {
    onConnection(transport: Transport) {
      logger.info('connection made, creating Thrift Service Manager');
      // eslint-disable-next-line no-unused-vars
      const thriftServerManager = new ThriftServerManager(transport);
    },
  });

  return Promise.resolve();
};
