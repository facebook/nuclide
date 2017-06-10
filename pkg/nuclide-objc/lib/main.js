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

import featureConfig from 'nuclide-commons-atom/feature-config';
import ObjectiveCColonIndenter from './ObjectiveCColonIndenter';
import ObjectiveCBracketBalancer from './ObjectiveCBracketBalancer';

class Activation {
  _indentFeature: ObjectiveCColonIndenter;
  _bracketFeature: ObjectiveCBracketBalancer;
  _configSubscription: IDisposable;

  constructor() {
    this._indentFeature = new ObjectiveCColonIndenter();
    this._indentFeature.enable();

    this._bracketFeature = new ObjectiveCBracketBalancer();
    this._configSubscription = featureConfig.observe(
      'nuclide-objc.enableAutomaticSquareBracketInsertion',
      enabled =>
        enabled
          ? this._bracketFeature.enable()
          : this._bracketFeature.disable(),
    );
  }

  dispose() {
    this._configSubscription.dispose();
    this._bracketFeature.disable();
    this._indentFeature.disable();
  }
}

let activation: ?Activation;

export function activate(state: ?mixed): void {
  if (!activation) {
    activation = new Activation();
  }
}

export function deactivate(): void {
  if (activation) {
    activation.dispose();
    activation = null;
  }
}
