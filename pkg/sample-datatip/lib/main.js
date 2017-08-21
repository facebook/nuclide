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

import type {DatatipProvider, DatatipService} from 'atom-ide-ui';

import {CompositeDisposable} from 'atom';
import invariant from 'assert';
import {datatip} from './SampleDatatip';

const PACKAGE_NAME = 'sample-datatip';

const datatipProvider: DatatipProvider = {
  // show the sample datatip for every type of file
  providerName: PACKAGE_NAME,
  priority: 1,
  datatip,
};

class Activation {
  _disposables: CompositeDisposable;

  constructor(state: ?mixed) {
    this._disposables = new CompositeDisposable();
  }

  consumeDatatipService(service: DatatipService): IDisposable {
    const disposable = service.addProvider(datatipProvider);
    this._disposables.add(disposable);
    return disposable;
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

let activation: ?Activation = null;

export function activate(state: ?Object): void {
  activation = new Activation(state);
}

export function consumeDatatipService(service: DatatipService): IDisposable {
  invariant(activation);
  return activation.consumeDatatipService(service);
}

export function deactivate(): void {
  if (activation != null) {
    activation.dispose();
    activation = null;
  }
}
