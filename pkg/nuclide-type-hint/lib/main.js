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
import type {
  DatatipProvider,
  DatatipService,
} from '../../nuclide-datatip/lib/types';
import type TypeHintManagerType from './TypeHintManager';

import invariant from 'assert';
import {CompositeDisposable, Disposable} from 'atom';
import TypeHintManager from './TypeHintManager';

const PACKAGE_NAME = 'nuclide-type-hint';

class Activation {
  _disposables: CompositeDisposable;
  typeHintManager: ?TypeHintManagerType;

  constructor(state: ?any) {
    this._disposables = new CompositeDisposable();
    if (this.typeHintManager == null) {
      this.typeHintManager = new TypeHintManager();
    }
  }

  consumeTypehintProvider(provider: TypeHintProvider): IDisposable {
    invariant(this.typeHintManager);
    this.typeHintManager.addProvider(provider);
    return new Disposable(() => {
      if (this.typeHintManager != null) {
        this.typeHintManager.removeProvider(provider);
      }
    });
  }

  consumeDatatipService(service: DatatipService): IDisposable {
    invariant(this.typeHintManager);
    const datatip = this.typeHintManager.datatip.bind(this.typeHintManager);
    const datatipProvider: DatatipProvider = {
      validForScope: () => true,
      providerName: PACKAGE_NAME,
      inclusionPriority: 1,
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
