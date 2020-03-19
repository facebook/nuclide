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

import type {TypeHintProvider} from './types';
import type {DatatipProvider, DatatipService} from 'atom-ide-ui';

import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import TypeHintManager from './TypeHintManager';

const PACKAGE_NAME = 'nuclide-type-hint';

class Activation {
  _disposables: UniversalDisposable;
  typeHintManager: TypeHintManager;

  constructor(state: ?any) {
    this._disposables = new UniversalDisposable();
    this.typeHintManager = new TypeHintManager();
  }

  consumeTypehintProvider(provider: TypeHintProvider): IDisposable {
    return this.typeHintManager.addProvider(provider);
  }

  consumeDatatipService(service: DatatipService): IDisposable {
    const datatip = this.typeHintManager.datatip.bind(this.typeHintManager);
    const datatipProvider: DatatipProvider = {
      providerName: PACKAGE_NAME,
      priority: 1,
      datatip,
    };
    const disposable = service.addProvider(datatipProvider);
    this._disposables.add(disposable);
    return disposable;
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

let activation: ?Activation = null;

export function activate(state: ?any): void {
  activation = new Activation(state);
}

export function consumeTypehintProvider(
  provider: TypeHintProvider,
): IDisposable {
  invariant(activation);
  return activation.consumeTypehintProvider(provider);
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
