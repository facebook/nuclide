/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  nuclide-internal/no-commonjs: 0,
  */

/**
 * @param {LauncherParameters} launcherParams
 * @return {Promise<void>}
 */
module.exports = function(launcherParams) {
  const {webSocketServer} = launcherParams;
  webSocketServer.on('connection', socket => {
    socket.on('message', data => {
      socket.send(`Received ${data}`);
    });
  });

  // The contract of the launcher's main() is that it must return a Promise
  // that resolves when the server is initialized.
  return Promise.resolve();
};
