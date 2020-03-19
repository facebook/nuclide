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

import type {BigDigServer} from '../../server/BigDigServer';
import type {Transport} from '../../server/BigDigServer';

import {TunnelManager} from './TunnelManager';

import {getLogger} from 'log4js';

const logger = getLogger('tunnel-service');

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports = function launch(server: BigDigServer): Promise<void> {
  logger.info('adding tunnel subscriber!');

  server.addSubscriber('tunnel', {
    onConnection(transport: Transport) {
      logger.info('connection made, creating TunnelManager');
      // eslint-disable-next-line no-unused-vars
      const tunnelManager = new TunnelManager(transport); // when do we close this?
    },
  });

  return Promise.resolve();
};
