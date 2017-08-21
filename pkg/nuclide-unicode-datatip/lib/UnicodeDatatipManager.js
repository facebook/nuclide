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

import unescapedUnicodeDatatip from './UnescapedUnicodeDatatip';

export default class UnicodeDatatipManager {
  _disposables: CompositeDisposable;

  constructor() {
    this._disposables = new CompositeDisposable();
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeDatatipService(service: DatatipService): IDisposable {
    const datatipProvider: DatatipProvider = {
      datatip: (editor, position) => unescapedUnicodeDatatip(editor, position),
      providerName: 'nuclide-unicode-escapes',
      priority: 1,
    };

    const disposable = service.addProvider(datatipProvider);
    this._disposables.add(disposable);
    return disposable;
  }
}
