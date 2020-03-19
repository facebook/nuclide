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
import type {ThriftPtyClient} from './types';

// $FlowIgnore
import pty_types from './gen-nodejs/pty_types';
import {getLogger} from 'log4js';

const logger = getLogger('run-thrift-pty');

export async function readPtyUntilExit(
  ptyId: number,
  thriftPtyClient: ThriftPtyClient,
  onNewOutput: Buffer => void,
): Promise<number> {
  return new Promise(async (resolve, reject) => {
    const POLL_TIMEOUT_SEC = 60;

    const _poll = async () => {
      try {
        const pollEvent = await thriftPtyClient.poll(ptyId, POLL_TIMEOUT_SEC);
        switch (pollEvent.eventType) {
          case pty_types.PollEventType.NEW_OUTPUT: {
            onNewOutput(pollEvent.chunk);
            setTimeout(_poll, 0);
            break;
          }
          case pty_types.PollEventType.TIMEOUT: {
            setTimeout(_poll, 0);
            break;
          }
          case pty_types.PollEventType.NO_PTY: {
            resolve(pollEvent.exitCode);
            break;
          }
          default: {
            logger.error('unknown PollEventType type', pollEvent.eventType);
            resolve(1);
          }
        }
      } catch (e) {
        logger.info(e);
        logger.info('caught error, exiting pty');
        resolve(1);
      }
    };

    await _poll();
  });
}
