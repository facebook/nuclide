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

import type {RegisterIndieLinter} from 'atom-ide-ui';

import createPackage from 'nuclide-commons-atom/createPackage';
import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import PackageModel from './PackageModel';
import PanelViewModel, {WORKSPACE_ITEM_URI} from './PanelViewModel';

class Activation {
  _disposables: UniversalDisposable;
  _model = new PackageModel();

  constructor(state: ?mixed) {
    this._disposables = new UniversalDisposable(
      this._model,
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_ITEM_URI) {
          return new PanelViewModel(this._model);
        }
      }),
      () => destroyItemWhere(item => item instanceof PanelViewModel),
      atom.commands.add(
        'atom-workspace',
        'sample-diagnostics-tester:toggle',
        () => {
          atom.workspace.toggle(WORKSPACE_ITEM_URI);
        },
      ),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeIndie(register: RegisterIndieLinter): IDisposable {
    const linter = register({name: 'Sample Diagnostics Tester'});
    this._disposables.add(linter);
    return new UniversalDisposable(
      this._model.observeMessages(messages => {
        linter.setAllMessages(messages);
      }),
      () => {
        this._disposables.remove(linter);
      },
    );
  }

  deserializeDiagnosticsTester(): PanelViewModel {
    return new PanelViewModel(this._model);
  }
}

createPackage(module.exports, Activation);
