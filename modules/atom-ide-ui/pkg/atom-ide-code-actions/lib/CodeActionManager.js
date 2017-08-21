/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {arrayFlatten} from 'nuclide-commons/collection';

import type {CodeActionProvider, CodeActionFetcher} from './types';

export class CodeActionManager {
  _providerRegistry: ProviderRegistry<CodeActionProvider>;
  _disposables: UniversalDisposable;

  constructor() {
    this._providerRegistry = new ProviderRegistry();
    this._disposables = new UniversalDisposable();
  }

  dispose() {
    this._disposables.dispose();
  }

  addProvider(provider: CodeActionProvider) {
    this._disposables.add(this._providerRegistry.addProvider(provider));
  }

  createCodeActionFetcher(): CodeActionFetcher {
    return {
      getCodeActionForDiagnostic: (diagnostic, editor) => {
        if (diagnostic.range) {
          const {range} = diagnostic;
          const codeActionRequests = [];
          for (const provider of this._providerRegistry.getAllProvidersForEditor(
            editor,
          )) {
            codeActionRequests.push(
              provider.getCodeActions(editor, range, [diagnostic]),
            );
          }

          return Promise.all(codeActionRequests).then(results =>
            arrayFlatten(results),
          );
        }
        return Promise.resolve([]);
      },
    };
  }
}
