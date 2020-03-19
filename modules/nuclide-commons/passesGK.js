/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import once from './once';
import UniversalDisposable from './UniversalDisposable';

/**
 * Get the actual Gatekeeper constructor or stub the relevant methods for OSS
 * friendliness.
 */
const getGatekeeper = once(() => {
  let Gatekeeper;
  try {
    // $FlowFB
    Gatekeeper = require('../fb-gatekeeper-raw').Gatekeeper; // eslint-disable-line nuclide-internal/modules-dependencies
  } catch (e) {
    Gatekeeper = class {
      isGkEnabled(name: string): ?boolean {
        return null;
      }

      asyncIsGkEnabled(name: string, timeout?: number): Promise<?boolean> {
        return Promise.resolve();
      }

      onceGkInitialized(callback: () => mixed): IDisposable {
        let canceled = false;
        process.nextTick(() => {
          if (!canceled) {
            callback();
          }
        });
        return new UniversalDisposable(() => {
          canceled = true;
        });
      }

      getCacheEntries(): Iterable<[string, boolean]> {
        return [];
      }
    };
  }
  return new Gatekeeper();
});

/**
 * Check a GK. Silently return false on error.
 *
 * (NOTE) The underlying module (fb-gatekeeper) checks the Unix name the node
 * process is running on. If you use this predicate in a package running on the
 * server (e.g., a language service backend) then it might not check the Unix
 * name you expect (e.g., `svmscm` on an On Demand instead of the user's Unix
 * name).
 */
export default (async function passesGK(
  name: string,
  // timeout in ms
  timeout?: number,
): Promise<boolean> {
  const gatekeeper = getGatekeeper();
  try {
    return (await gatekeeper.asyncIsGkEnabled(name, timeout)) === true;
  } catch (e) {
    // If the Gatekeeper class implements caching, this may retrieve a cached value.
    return gatekeeper.isGkEnabled(name) === true;
  }
});

/**
 * Synchronous GK check. There is no guarantee that GKs have loaded. This
 * should be used inside a `onceGkInitialized`.
 *
 * (NOTE) The underlying module (fb-gatekeeper) checks the Unix name the node
 * process is running on. If you use this predicate in a package running on the
 * server (e.g., a language service backend) then it might not check the Unix
 * name you expect (e.g., `svcscm` on an On Demand instead of the user's Unix
 * name).
 */
export function isGkEnabled(name: string): ?boolean {
  return getGatekeeper().isGkEnabled(name);
}

export function onceGkInitialized(callback: () => mixed): IDisposable {
  return getGatekeeper().onceGkInitialized(callback);
}

export function onceGkInitializedAsync(): Promise<void> {
  return new Promise(resolve => {
    getGatekeeper().onceGkInitialized(() => resolve());
  });
}

export function getCacheEntries(): Iterable<[string, boolean]> {
  return getGatekeeper().getCacheEntries();
}
