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

import type {ServiceConnection} from 'nuclide-commons-atom/experimental-packages/types';

import {getLogger} from 'log4js';
import {initializeLogging} from '../../nuclide-logging';

initializeLogging();
const logger = getLogger('sample-experimental-console-service');

function connectClient(connection: ServiceConnection): void {
  const {sourceName} = connection.config;
  if (sourceName == null) {
    logger.error(
      'Improperly configured consumer sample-experimental-console-service consumer. ' +
        'You need a source name in your config!',
    );
    return;
  }

  connection.onNotification(
    {method: 'message'},
    (params: {message: string}) => {
      logger.info(`got message from ${sourceName}`, params);
    },
  );
}

export default class Package {
  constructor(
    services: {},
    serviceConsumers: {console: Array<ServiceConnection>},
  ) {
    logger.info('loaded main.js');
    serviceConsumers.console.forEach(connection => {
      connectClient(connection);
    });
  }

  dispose(): void {
    logger.info('disposed!');
  }
}
