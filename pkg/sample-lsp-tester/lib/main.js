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

import type {
  WorkspaceViewsService,
} from '../../nuclide-workspace-views/lib/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {WORKSPACE_VIEW_URI, LspTester} from './LspTester';

class Activation {
  _disposables: UniversalDisposable;

  constructor(state: ?mixed) {
    this._disposables = new UniversalDisposable();
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
    this._disposables.add(
      api.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return new LspTester();
        }
      }),
      () => api.destroyWhere(item => item instanceof LspTester),
      atom.commands.add('atom-workspace', 'sample-lsp-tester:toggle', event => {
        api.toggle(WORKSPACE_VIEW_URI, (event: any).detail);
      }),
    );
  }

  deserializeLspTester(serialized: ?mixed): LspTester {
    const data = (serialized && serialized.data) || null;
    return new LspTester({
      lastCommand: data != null && typeof data.lastCommand === 'string'
        ? data.lastCommand || null
        : null,
    });
  }
}

createPackage(module.exports, Activation);
