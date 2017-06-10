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

import invariant from 'assert';
import {CompositeDisposable} from 'atom';
import {WorkingSetsStore} from './WorkingSetsStore';
import {WorkingSetsConfig} from './WorkingSetsConfig';
import {PathsObserver} from './PathsObserver';

class Activation {
  workingSetsStore: WorkingSetsStore;
  _workingSetsConfig: WorkingSetsConfig;
  _disposables: CompositeDisposable;

  constructor() {
    this.workingSetsStore = new WorkingSetsStore();
    this._workingSetsConfig = new WorkingSetsConfig();
    this._disposables = new CompositeDisposable();

    this._disposables.add(
      this.workingSetsStore.onSaveDefinitions(definitions => {
        this._workingSetsConfig.setDefinitions(definitions);
      }),
    );

    this._disposables.add(
      this._workingSetsConfig.observeDefinitions(definitions => {
        this.workingSetsStore.updateDefinitions(definitions);
      }),
    );

    this._disposables.add(
      atom.commands.add(
        'atom-workspace',
        'working-sets:toggle-last-selected',
        this.workingSetsStore.toggleLastSelected.bind(this.workingSetsStore),
      ),
    );

    this._disposables.add(new PathsObserver(this.workingSetsStore));
  }

  deactivate(): void {
    this._disposables.dispose();
  }
}

let activation: ?Activation = null;

export function activate() {
  if (activation != null) {
    return;
  }

  activation = new Activation();
}

export function deactivate() {
  if (activation == null) {
    return;
  }

  activation.deactivate();
  activation = null;
}

export function provideWorkingSetsStore(): WorkingSetsStore {
  invariant(
    activation,
    'Was requested to provide service from a non-activated package',
  );

  return activation.workingSetsStore;
}
