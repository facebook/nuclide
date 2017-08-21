/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @noflow
 */
'use strict';

/* eslint
  comma-dangle: [1, always-multiline],
  prefer-object-spread/prefer-object-spread: 0,
  nuclide-internal/no-commonjs: 0,
  */

/* eslint-disable no-console */

// Starts listening for xdebug connections on the given port.
// Once connected you can enter xdebug commands, messages from the xdebug connection
// are displayed on stdout.
//
// After starting this script, run start-hhvm-client.sh to launch hhvm with xdebug enabled.

// Matches an xdebug command name, e.g. matches 'eval' in 'eval -i 3 -- data'.
const COMMAND_NAME_MATCHER = /^(\w+)/;

const port = process.argv[2] || 9000;

console.log('Attempting to connect on port: ' + port);

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
  prompt: 'xdebug> ',
});

let socket = null;

const net = require('net');
const server = net.createServer(
  c => {
    socket = c;
    console.log('client connected');
    socket.on('end', () => {
      console.log('client disconnected');
    });

    socket.on('data', data => {
      console.log('server: ' + data.toString());
      const components = data.toString().split('\x00');
      console.log('components count: ' + components.length);
      console.log('message content length: ' + components[1].length);
      rl.prompt();
    });
  });

server.listen(port, () => { // 'listening' listener
  console.log('server bound... waiting for connection from debugger');
});

let commandId = 0;
rl.on('line', line_ => {
  if (socket == null) {
    return;
  }
  const line = line_.trim();
  if (!line) {
    return;
  }
  const matches = COMMAND_NAME_MATCHER.exec(line);
  if (matches == null) {
    return;
  }
  ++commandId;
  const match = matches[0];
  const lineEnd = line.substring(match.length + 1); // + 1 for the leading space.
  const lineWithId = `${match} -i ${commandId} ${lineEnd}`.trim();
  console.log('local: ' + lineWithId);
  socket.write(lineWithId + '\0', undefined /* encoding */, () => {
    console.log('finished writing: ' + lineWithId);
  });
});
