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

import https from 'https';
import http from 'http';
import fs from 'fs';
import url from 'url';

// Set the initial version by reading from the file.
const json = JSON.parse(
  fs.readFileSync(require.resolve('./package.json'), 'utf8'),
);
const version = /^(\d+)\.(\d+)\.(\d+)(?:-([a-z0-9.-]+))?$/.exec(
  json.version,
)[2];

function processArgs() {
  const args = process.argv.slice(2);
  const processedArgs = {};

  args.forEach((argument, index) => {
    if (index % 2 !== 0) {
      processedArgs[args[index - 1].slice(2)] = argument;
    }
  });
  return processedArgs;
}

function startServer(args) {
  let _webServer;
  if (args.key && args.cert && args.ca) {
    const webServerOptions = {
      key: fs.readFileSync(args.key),
      cert: fs.readFileSync(args.cert),
      ca: fs.readFileSync(args.ca),
      requestCert: true,
      rejectUnauthorized: true,
    };

    _webServer = https.createServer(webServerOptions, handleRequest);
    // eslint-disable-next-line no-console
    console.log('running in secure mode');
  } else {
    _webServer = http.createServer(handleRequest);
  }

  _webServer.on('listening', () => {
    // eslint-disable-next-line no-console
    console.log('listening on port ' + args.port);
  });

  _webServer.listen(args.port || 8084, '::');
}

function handleRequest(request, response) {
  const pathname = url.parse(request.url, false).pathname;

  switch (pathname) {
    case '/heartbeat':
      handleVersion(request, response);
      break;
    default:
      response.writeHead(500);
      response.write('This mock server does not understand that command');
      response.end();
      break;
  }
}

function handleVersion(request, response) {
  response.writeHead(200);
  response.write(version);
  response.end();
}

startServer(processArgs());
