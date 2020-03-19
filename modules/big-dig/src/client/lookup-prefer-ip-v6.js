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

import invariant from 'assert';
import dns from 'dns';

export type DnsFamily = 4 | 6;

export type DnsLookup = {
  address: string,
  family: DnsFamily,
};

export default (async function lookupPreferIpv6(
  host: string,
): Promise<DnsLookup> {
  try {
    return await lookup(host, 6);
  } catch (e) {
    if (e.code === 'ENOTFOUND') {
      return lookup(host, 4);
    }
    throw e;
  }
});

function lookup(host: string, family: DnsFamily): Promise<DnsLookup> {
  return new Promise((resolve, reject) => {
    dns.lookup(
      host,
      family,
      (error: ?Error, address: ?string, resultFamily: ?number) => {
        if (error) {
          reject(error);
        } else if (address != null) {
          invariant(resultFamily === 4 || resultFamily === 6);
          resolve({address, family: resultFamily});
        } else {
          reject(new Error('One of error or address must be set.'));
        }
      },
    );
  });
}
