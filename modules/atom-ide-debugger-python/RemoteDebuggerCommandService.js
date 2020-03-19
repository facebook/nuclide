/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {ConnectableObservable} from 'rxjs';

import http from 'http';
import net from 'net';
import {Observable, Subject} from 'rxjs';
import {getLogger} from 'log4js';
import {sleep} from 'nuclide-commons/promise';

let isServerSetup = false;

export type RemoteDebugCommandRequest = {
  type: 'python',
  command: 'attach',
  target: PythonDebuggerAttachTarget,
};

export type PythonDebuggerAttachTarget = {
  port: number,
  localRoot: ?string,
  remoteRoot: ?string,
  debugOptions: ?Array<string>,
  id: ?string,
};

const debugRequests: Subject<RemoteDebugCommandRequest> = new Subject();
const attachReady: Map<number, PythonDebuggerAttachTarget> = new Map();
const DEBUGGER_REGISTRY_PORT = 9615;

export function observeRemoteDebugCommands(): ConnectableObservable<
  RemoteDebugCommandRequest,
> {
  let setupStep;
  if (!isServerSetup) {
    setupStep = Observable.fromPromise(setupServer()).ignoreElements();
  } else {
    setupStep = Observable.empty();
  }
  return setupStep.concat(debugRequests).publish();
}

export function observeAttachDebugTargets(): ConnectableObservable<
  Array<PythonDebuggerAttachTarget>,
> {
  // Validate attach-ready values with the processes with used ports (ready to attach).
  // Note: we can't use process ids because we could be debugging processes inside containers
  // where the process ids don't map to the host running this code.
  return Observable.interval(3000)
    .startWith(0)
    .switchMap(() =>
      Promise.all(
        Array.from(attachReady.values()).map(async target => {
          if (!(await isPortUsed(target.port))) {
            attachReady.delete(target.port);
          }
        }),
      ),
    )
    .map(() => Array.from(attachReady.values()))
    .publish();
}

function isPortUsed(port: number): Promise<boolean> {
  const tryConnectPromise = new Promise((resolve, reject) => {
    const client = new net.Socket();
    client
      .once('connect', () => {
        cleanUp();
        resolve(true);
      })
      .once('error', err => {
        cleanUp();
        resolve(err.code !== 'ECONNREFUSED');
      });

    function cleanUp() {
      client.removeAllListeners('connect');
      client.removeAllListeners('error');
      client.end();
      client.destroy();
      client.unref();
    }

    client.connect({port, host: '127.0.0.1'});
  });
  // Trying to connect can take multiple seconds, then times out (if the server is busy).
  // Hence, we need to fallback to `true`.
  const connectTimeoutPromise = sleep(1000).then(() => true);
  return Promise.race([tryConnectPromise, connectTimeoutPromise]);
}

function setupServer(): Promise<void> {
  return new Promise((resolve, reject) => {
    http
      .createServer((req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(500, {'Content-Type': 'text/html'});
          res.end('Invalid request');
        } else {
          let body = '';
          req.on('data', data => {
            body += data;
          });
          req.on('end', () => {
            handleJsonRequest(JSON.parse(body), res);
          });
        }
      })
      .on('error', reject)
      .listen((DEBUGGER_REGISTRY_PORT: any), () => {
        isServerSetup = true;
        resolve();
      });
  });
}

function handleJsonRequest(body, res) {
  res.writeHead(200, {'Content-Type': 'application/json'});
  const {domain, command, type} = body;
  let success = false;
  if (domain !== 'debug' || type !== 'python') {
    res.end(JSON.stringify({success}));
    return;
  }
  if (command === 'enable-attach') {
    const port = Number(body.port);
    const {options} = body;
    const target = {
      port,
      id: options.id,
      localRoot: options.localRoot,
      remoteRoot: options.remoteRoot,
      debugOptions: options.debugOptions,
    };
    attachReady.set(port, target);
    getLogger().info('Remote debug target is ready to attach', target);
    success = true;
  } else if (command === 'attach') {
    const port = Number(body.port);
    getLogger().info('Remote debug target attach request', body);
    const target = attachReady.get(port);
    if (target != null) {
      debugRequests.next({
        type,
        command,
        target,
      });
      success = true;
    }
  }
  res.end(JSON.stringify({success}));
}
