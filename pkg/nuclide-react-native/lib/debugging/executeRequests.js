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

import type {ExecutorResponse, ExecutorRequest} from './types';

import featureConfig from 'nuclide-commons-atom/feature-config';
import {fork, getOutputStream} from 'nuclide-commons/process';
import {getLogger} from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';

const logger = getLogger('nuclide-react-native');

/**
 * This function models the executor side of the debugging equation: it receives a stream of
 * instructions from the RN app, executes them, and emits a stream of results.
 */
export function executeRequests(
  requests: Observable<ExecutorRequest>,
): Observable<ExecutorResponse> {
  // Wait until we get the first request, then spawn a worker process for processing them.
  const workerProcess = requests.first().switchMap(createWorker).share();

  return workerProcess
    .switchMap(process =>
      Observable.merge(
        Observable.of({kind: 'pid', pid: process.pid}),
        // The messages we're receiving from the worker process.
        Observable.fromEvent(process, 'message'),
        // Send the incoming requests to the worker process for evaluation.
        requests.do(request => process.send(request)).ignoreElements(),
        // Pipe output from forked process. This just makes things easier to debug for us.
        getOutputStream(process, {
          /* TODO(T17353599) */ isExitError: () => false,
        })
          .do(message => {
            switch (message.kind) {
              case 'error':
                logger.error(message.error.message);
                return;
              case 'stderr':
              case 'stdout':
                logger.info(message.data.toString());
                return;
            }
          })
          .ignoreElements(),
      ),
    )
    .share();
}

function createWorker(): Observable<child_process$ChildProcess> {
  return fork(
    // TODO: The node location/path needs to be more configurable. We need to figure out a way to
    //   handle this across the board.
    nuclideUri.join(__dirname, 'executor.js'),
    [],
    {
      execArgv: ['--debug-brk'],
      execPath: ((featureConfig.get(
        'nuclide-react-native.pathToNode',
      ): any): string),
      silent: true,
    },
  );
}
