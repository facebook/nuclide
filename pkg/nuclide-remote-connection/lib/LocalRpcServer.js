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

import child_process from 'child_process';
import {getLogger} from 'log4js';
import {track} from 'nuclide-analytics';
import {getServerSideMarshalers} from '../../nuclide-marshalers-common';
import servicesConfig from '../../nuclide-server/lib/servicesConfig';
import {RpcConnection, ServiceRegistry} from '../../nuclide-rpc';
import {initializeLogging, flushLogsAndAbort} from '../../nuclide-logging';
import {IpcServerTransport} from './IpcTransports';

initializeLogging();

const logger = getLogger('LocalRpcServer');

process.on('uncaughtException', err => {
  // Log the error and continue the server crash.
  logger.fatal('Uncaught exception in LocalRpcServer', err);
  flushLogsAndAbort();
});

process.on('unhandledRejection', (error, promise) => {
  logger.error('Unhandled promise rejection in LocalRpcServer', error);
});

// Make sure that we cleanly exit if the parent (Atom) goes away.
process.on('disconnect', () => {
  process.exit();
});

// And when we do exit, make sure that all child processes get cleaned up.
process.on('exit', () => {
  // $FlowIgnore: Private method.
  process._getActiveHandles().forEach(handle => {
    if (handle instanceof child_process.ChildProcess) {
      handle.kill();
    }
  });
});

// According to https://nodejs.org/api/process.html#process_signal_events,
// Node.js should ignore SIGPIPE by default.
// However, we've seen reports in production of users getting SIGPIPE
// from their LocalRpcServer processes. Let's try to find out why...
process.on('SIGPIPE', () => {
  // Wrap in an Error to get a stack trace.
  logger.error(Error('Received unexpected SIGPIPE, ignoring...'));
});

// If we started this with --inspect, don't pass that on to the children.
// Can be removed once --inspect=0 is usable.
if (
  process.execArgv.length > 0 &&
  process.execArgv[0].startsWith('--inspect')
) {
  process.execArgv.splice(0, 1);
}

const serviceRegistry = new ServiceRegistry(
  getServerSideMarshalers,
  servicesConfig,
);
const serverTransport = new IpcServerTransport();
RpcConnection.createServer(serviceRegistry, serverTransport);

logger.info('Started local RPC server.');

const HEALTH_INTERVAL = 10 * 60 * 1000;

// Track RPC server memory usage.
// $FlowIssue: process.cpuUsage doesn't exist
let lastCpuUsage = process.cpuUsage();
setInterval(() => {
  // $FlowIssue: process.cpuUsage doesn't exist
  const cpuUsage = process.cpuUsage();
  track('local-rpc-health', {
    ...process.memoryUsage(),
    // 1) CPU stats are in microseconds. Seconds are more convenient.
    // 2) CPU stats are cumulative, so take the delta. The API is supposed to provide
    //    a diff if given the previous value, but this doesn't work correctly in practice.
    cpuUser: (cpuUsage.user - lastCpuUsage.user) / 1e6,
    cpuSystem: (cpuUsage.system - lastCpuUsage.system) / 1e6,
  });
  lastCpuUsage = cpuUsage;
}, HEALTH_INTERVAL);
