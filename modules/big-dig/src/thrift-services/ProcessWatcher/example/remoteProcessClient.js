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

/* eslint-disable no-console */

import type {ProcessMessage} from 'nuclide-commons/process.js';

import {getLogger} from 'log4js';
import {getWrappedThriftClient} from '../../../services/thrift/createThriftClient';
import {PROCESS_WATCHER_SERVICE_CONFIG} from '../thrift-process-watcher-config';
import {observeProcess} from '../ProcessWatcherUtil';
import {Observable} from 'rxjs';

const logger = getLogger('remote-process-example');

async function main() {
  const port = parseInt(process.argv[2], 10);
  let cmd = process.argv[3];
  let cmdArgs = process.argv.slice(4, process.argv.length);

  if (cmd == null) {
    logger.info('using default command `ls -lsa`');
    cmd = 'ls';
    cmdArgs = ['-lsa'];
  }
  const wrappedClient = getWrappedThriftClient(
    PROCESS_WATCHER_SERVICE_CONFIG,
    port,
  );

  wrappedClient.onUnexpectedClientFailure(() => {
    logger.error('Connection closed. Exiting.');
    process.exit(1);
  });

  const client = wrappedClient.getClient();

  const handleMessage = (message: ProcessMessage) => {
    switch (message.kind) {
      case 'stdout':
        process.stdout.write(message.data);
        break;
      case 'stderr':
        process.stderr.write(message.data);
        break;
      case 'exit':
        logger.info(
          'exiting with code',
          message.exitCode,
          'signal',
          message.signal,
        );
        if (message.exitCode != null) {
          process.exit(message.exitCode);
        }
        break;
      default:
        console.error('unknown kind', message);
    }
  };

  try {
    const processObserver = observeProcess(client, cmd, cmdArgs);
    const subscription = processObserver
      .catch(e => {
        console.error(e);
        return Observable.of();
      })
      .subscribe(handleMessage);

    setTimeout(() => {
      logger.info('unsubscribing');
      subscription.unsubscribe();
      setTimeout(() => process.exit(0), 1000);
    }, 2000);
  } catch (e) {
    logger.error(`failed to run "${cmd} ${cmdArgs.join(' ')}"`);
    logger.error(e);
    process.exit(1);
  }
}

main();
