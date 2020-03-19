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

import type {InitializeMessage, PipedMessage} from './types';

import invariant from 'assert';
import log4js from 'log4js';
import MessageRouter from './MessageRouter';
import activatePackage from './activatePackage';

// Send log4js errors to stderr for visibility from the main process.
log4js.configure({
  appenders: [{type: 'stderr'}],
});

const logger = log4js.getLogger('experimental-run-package');
process.on('uncaughtException', err => {
  logger.fatal('Uncaught exception:', err);
  log4js.shutdown(() => process.abort());
});

process.on('unhandledRejection', err => {
  logger.warn('Unhandled rejection', err);
});

// Properly terminate if the parent server crashes.
process.on('disconnect', () => {
  process.exit();
});

process.once('message', ({packages, exposedSockets}: InitializeMessage) => {
  const messageRouter = new MessageRouter();

  // Route incoming IPC messages into the message router.
  process.on('message', (message: PipedMessage) => {
    messageRouter.send(message);
  });

  // Messages to external sockets need to go over IPC.
  exposedSockets.forEach(socket => {
    messageRouter
      .getMessages(socket)
      .mergeMap(
        message =>
          new Promise(resolve => {
            invariant(process.send != null);
            process.send(message, resolve);
          }),
        /* Set concurrency to 1 to avoid blocking IPC. */ 1,
      )
      .subscribe();
  });

  // Create connections for each provided service.
  const activatedPackages = packages.map(pkg => {
    return activatePackage(pkg, messageRouter);
    // ??? Maybe there should be an explicit signal or shutdown message via IPC.
  });

  process.on('exit', () => {
    activatedPackages.forEach(pkg => {
      if (pkg.dispose != null) {
        pkg.dispose();
      }
    });
  });
});
