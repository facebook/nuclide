'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

// undefined means unknown. null means known to not be present.
let gatekeeper = undefined;

/**
 * Check a GK. Silently return false on error.
 */
export default async function passesGK(
  gatekeeperName: string,
  timeout?: number
): Promise<boolean> {
  // Only do the expensive require once.
  if (gatekeeper === undefined) {
    try {
      // $FlowFB
      gatekeeper = require('../fb-gatekeeper').gatekeeper;
    } catch (e) {
      gatekeeper = null;
    }
  }

  if (gatekeeper == null) {
    return false;
  }
  try {
    return (await gatekeeper.asyncIsGkEnabled(gatekeeperName, timeout)) === true;
  } catch (e) {
    return false;
  }
}
