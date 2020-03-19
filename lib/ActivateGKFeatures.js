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

/**
 * Usage: In the feature package's `package.json`, add:
 *
 *  "activationHooks": [
 *    "my_gk_name:gk:nuclide"
 *  ]
 *
 * Now, the package will only load and activate if the GK is enabled.
 */

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {onceGkInitialized, isGkEnabled} from 'nuclide-commons/passesGK';

// May use: "!my_gk_name:gk:nuclide" to avoid activating the package when the GK passes.
const GK_HOOK_RE = /^(!?)([\w-]+):gk:nuclide$/;

export default class ActivateGKFeatures {
  _subscriptions: UniversalDisposable;

  constructor() {
    this._subscriptions = new UniversalDisposable();

    const boundOnGKInitialized = this._onGKInitialized.bind(this);

    if (atom.inSpecMode()) {
      // call in next tick to more closely simulate what's happening in the normal case
      process.nextTick(boundOnGKInitialized);
    } else {
      this._subscriptions.add(onceGkInitialized(boundOnGKInitialized));
    }
  }

  _onGKInitialized() {
    const usedGKNames = new Set();

    for (const pack of atom.packages.getLoadedPackages()) {
      if (pack.metadata.nuclide != null) {
        for (const hookName of pack.getActivationHooks()) {
          const match = hookName.match(GK_HOOK_RE);
          if (match == null) {
            continue;
          }
          const [, isNegated, gkName] = match;
          if (atom.inSpecMode() || isGkEnabled(gkName) === !isNegated) {
            usedGKNames.add(hookName);
          }
        }
      }
    }

    for (const hookName of usedGKNames) {
      atom.packages.triggerActivationHook(hookName);
    }
  }

  dispose() {
    this._subscriptions.dispose();
  }
}
