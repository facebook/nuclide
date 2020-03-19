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

import fs from 'fs';

async function timedAsync<T>(
  promise: Promise<T>,
  waitUntilNoRequests: boolean = true,
): Promise<{
  time: number,
  promiseTime: number,
  promiseHandles: number,
  ret: T,
}> {
  const start = Date.now();
  const ret = await promise;
  const promiseTime = Date.now() - start;
  // $FlowFixMe: Use a public API
  const promiseHandles = process._getActiveRequests().length;
  if (waitUntilNoRequests) {
    await sleepUntilNoRequests();
  }
  const time = Date.now() - start;
  return {time, promiseTime, promiseHandles, ret};
}

function timedSync<T>(func: () => T): {time: number, ret: T} {
  const start = Date.now();
  const ret = func();
  Promise.resolve(sleepUntilNoRequests());
  const time = Date.now() - start;
  return {time, ret};
}

function makeSizedFixture(location: string, size: number): void {
  const file = fs.openSync(location, 'w');
  const line = '// ------\n';
  const lineLength = line.length;
  // $FlowFixMe: Bad upstream definition
  fs.truncateSync(file, 0);
  for (let i = 0; i < size; i += lineLength) {
    fs.writeSync(file, line);
  }
  fs.closeSync(file);
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, milliseconds);
  });
}

async function sleepUntilNoRequests(
  pollMilliseconds: number = 1,
): Promise<any> {
  // $FlowFixMe: use public API.
  while (process._getActiveRequests().length !== 0) {
    // eslint-disable-next-line no-await-in-loop
    await sleep(pollMilliseconds);
  }
}

function yellow(str: string): string {
  return `\x1b[93m${str}\x1b[0m`;
}

function green(str: string): string {
  return `\x1b[92m${str}\x1b[0m`;
}

// eslint-disable-next-line nuclide-internal/no-commonjs
module.exports = {
  timedAsync,
  timedSync,
  makeSizedFixture,
  sleep,
  sleepUntilNoRequests,
  yellow,
  green,
};
