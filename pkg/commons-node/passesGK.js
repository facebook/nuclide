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

import once from './once';
import {Disposable} from 'event-kit';

/**
 * Get the actual Gatekeeper constructor or stub the relevant methods for OSS
 * friendliness.
 */
const getGatekeeper = once(() => {
  let Gatekeeper;
  try {
    // $FlowFB
    Gatekeeper = require('./fb-gatekeeper').Gatekeeper;
  } catch (e) {
    Gatekeeper = class {
      isGkEnabled(name: string): ?boolean {
        return null;
      }
      asyncIsGkEnabled(name: string, timeout?: number): Promise<?boolean> {
        return Promise.resolve();
      }
      onceGkInitialized(callback: () => mixed): IDisposable {
        process.nextTick(() => {
          callback();
        });
        return new Disposable();
      }
    };
  }
  return new Gatekeeper();
});

/**
 * Check a GK. Silently return false on error.
 */
export default (async function passesGK(
  name: string,
  // timeout in ms
  timeout?: number,
): Promise<boolean> {
  try {
    return (await getGatekeeper().asyncIsGkEnabled(name, timeout)) === true;
  } catch (e) {
    return false;
  }
});

/**
 * Synchronous GK check. There is no guarantee that GKs have loaded. This
 * should be used inside a `onceGkInitialized`.
 */
export function isGkEnabled(name: string): ?boolean {
  return getGatekeeper().isGkEnabled(name);
}

export function onceGkInitialized(callback: () => mixed): IDisposable {
  return getGatekeeper().onceGkInitialized(callback);
}
