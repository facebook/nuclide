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
  DatatipProvider,
  DatatipService,
} from '../../nuclide-datatip/lib/types';

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
      validForScope: (scope: string) => true,
      providerName: 'nuclide-unicode-escapes',
      inclusionPriority: 1,
    };

    const disposable = service.addProvider(datatipProvider);
    this._disposables.add(disposable);
    return disposable;
  }
}
