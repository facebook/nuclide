/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict
 * @format
 */

import https from 'https';

/* $FlowFixMe - need to add Thrift server type, currently can only use 'any'
 * Add serverType in order to support multiple types of servers */
type serverType = https.Server | any;

/**
 * Represents a range of ports by an initial integer paired with the number of
 * elements in the range. If `length` is negative, then the range counts "down"
 * from `start` instead of counting "up". `length` should never be zero.
 */
type PortRange = {
  start: number,
  length: number,
};

export function parsePorts(portsDescriptor: string): Ports {
  const ranges = [];
  const descriptors = portsDescriptor
    .split(',')
    .map(x => x.trim())
    .filter(x => x !== '');
  for (const descriptor of descriptors) {
    let range = null;
    if (/^\d+$/.test(descriptor)) {
      range = {
        start: parseNonNegativeIntOrThrow(descriptor),
        length: 1,
      };
    } else {
      const match = descriptor.match(/^(\d+)-(\d+)$/);
      if (match != null) {
        const start = parseNonNegativeIntOrThrow(match[1]);
        const end = parseNonNegativeIntOrThrow(match[2]);
        const delta = end - start;
        range = {
          start,
          length: delta + (delta < 0 ? -1 : 1),
        };
      } else {
        throw new Error(`Could not parse ports from: "${descriptor}".`);
      }
    }
    ranges.push(range);
  }

  return new Ports(ranges);
}

/**
 * Class that is an iterable for port numbers.
 */
// $FlowIssue https://github.com/facebook/flow/issues/2286
class Ports implements Iterable<number> {
  _ranges: Array<PortRange>;

  constructor(ranges: Array<PortRange>) {
    this._ranges = ranges;
  }

  // $FlowIssue https://github.com/facebook/flow/issues/2286
  *[Symbol.iterator]() {
    for (const {start, length} of this._ranges) {
      const delta = length < 0 ? -1 : 1;
      let offset = 0;
      while (offset !== length) {
        yield start + offset;
        offset += delta;
      }
    }
  }
}

function parseNonNegativeIntOrThrow(str: string): number {
  const value = parseInt(str, 10);
  if (isNaN(value)) {
    throw new Error(`"${str}" could not be parsed as a valid integer.`);
  } else if (value === Infinity || value === -Infinity) {
    throw new Error(`${str} parses to an extrema: ${value}.`);
  } else if (value < 0) {
    throw new Error(`${str} parses to a negative number: ${value}.`);
  } else {
    return value;
  }
}

/**
 * Attempts to have the server listen to the specified port.
 * Returns true if successful or false if the port is already in use.
 * Any other errors result in a rejection.
 */
function tryListen(server: serverType, port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    function onError(error) {
      if (error.errno === 'EADDRINUSE') {
        return resolve(false);
      }
      reject(error);
    }

    server.once('error', onError);
    server.listen(port, () => {
      // Let errors after the initial listen fall through to the global exception handler.
      server.removeListener('error', onError);
      resolve(true);
    });
  });
}

/**
 * Scan ports to listen to an available port
 * @param ports string  e.g. '8082, 8089, 10222-10234'
 */
export async function scanPortsToListen(
  server: serverType,
  ports: string,
): Promise<boolean> {
  let found = false;
  for (const port of parsePorts(ports)) {
    // eslint-disable-next-line no-await-in-loop
    if (await tryListen(server, port)) {
      found = true;
      break;
    }
  }
  return found;
}
