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
import type {ThriftProcessWatcherClient, ThriftProcessMessage} from './types';

import {Observable, Subject} from 'rxjs';

function lastMessageExits(messages: Array<ThriftProcessMessage>) {
  const lastIndex = messages.length - 1;
  if (messages[lastIndex]) {
    return messages[lastIndex].kind === 'exit';
  }
  return false;
}

export function observeProcess(
  client: ThriftProcessWatcherClient,
  command: string,
  args?: Array<string>,
): Observable<ProcessMessage> {
  const subject = new Subject();
  let id: ?number = null;

  const _outputPoller = async () => {
    const timeout_sec = 1000;
    if (id != null) {
      try {
        const messages: Array<ThriftProcessMessage> = await client.nextMessages(
          id,
          timeout_sec,
        );
        messages.forEach(message => {
          subject.next(message);
        });

        if (!lastMessageExits(messages)) {
          setTimeout(_outputPoller, 0);
        }
      } catch (e) {
        subject.error(e);
      }
    }
  };

  const cmdArgs = args || [];
  return Observable.defer(() => client.watchProcess(command, cmdArgs))
    .switchMap(processId => {
      id = processId;
      _outputPoller();
      return subject;
    })
    .finally(() => {
      subject.complete();
      if (id != null) {
        client.unsubscribe(id);
      }
    });
}
