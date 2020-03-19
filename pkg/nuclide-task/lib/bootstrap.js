/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {RemoteMessage} from './bootloader';

import invariant from 'assert';
import child_process from 'child_process';

process.on('message', (message: RemoteMessage) => {
  const {id, file, method, args} = message;

  // $FlowIgnore
  const exports = require(file);
  const service = method != null ? exports[method] : exports;

  const sendSuccessResponse = result => {
    invariant(process.send != null);
    process.send({
      id,
      result,
    });
  };

  const sendErrorResponse = err => {
    invariant(process.send != null && err != null);
    process.send({
      id,
      error: {
        message: err.message || err,
        stack: err.stack || null,
      },
    });
  };

  // Invoke the service.
  let output;
  let error;
  try {
    output = service(...(args || []));
  } catch (e) {
    error = e;
  }

  if (error) {
    sendErrorResponse(error);
  } else if (output != null && typeof output.then === 'function') {
    output.then(sendSuccessResponse, sendErrorResponse);
  } else {
    sendSuccessResponse(output);
  }
});

process.on('uncaughtException', err => {
  // eslint-disable-next-line no-console
  console.error('uncaughtException:', err);
  process.exit(1);
});
// Properly terminate if the parent server crashes.
process.on('disconnect', () => {
  process.exit();
});
process.on('exit', () => {
  // Hack: kill all child processes.
  // $FlowIgnore: Private method.
  process._getActiveHandles().forEach(handle => {
    if (handle instanceof child_process.ChildProcess) {
      handle.kill();
    }
  });
});
