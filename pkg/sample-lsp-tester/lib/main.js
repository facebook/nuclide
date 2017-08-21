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

import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';
import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {WORKSPACE_VIEW_URI, LspTester} from './LspTester';

class Activation {
  _disposables: UniversalDisposable;

  constructor(state: ?mixed) {
    this._disposables = this._registerCommandAndOpener();
  }

  dispose(): void {
    this._disposables.dispose();
  }

  _registerCommandAndOpener(): UniversalDisposable {
    return new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return new LspTester();
        }
      }),
      () => destroyItemWhere(item => item instanceof LspTester),
      atom.commands.add('atom-workspace', 'sample-lsp-tester:toggle', () => {
        atom.workspace.toggle(WORKSPACE_VIEW_URI);
      }),
    );
  }

  deserializeLspTester(serialized: ?mixed): LspTester {
    // flowlint-next-line sketchy-null-mixed:off
    const data = (serialized && serialized.data) || null;
    return new LspTester({
      lastCommand:
        data != null && typeof data.lastCommand === 'string'
          ? data.lastCommand || null
          : null,
    });
  }
}

createPackage(module.exports, Activation);
