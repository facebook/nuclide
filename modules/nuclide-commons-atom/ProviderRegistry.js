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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export type Provider = {
  // Providers with higher priorities will be preferred over lower ones.
  priority: number,
  // Omitting grammarScopes implies that the provider applies to all grammars.
  +grammarScopes?: Array<string>,
};

export default class ProviderRegistry<T: Provider> {
  _providers: Array<T>;

  constructor() {
    this._providers = [];
  }

  addProvider(provider: T): IDisposable {
    const index = this._providers.findIndex(
      p => provider.priority > p.priority,
    );
    if (index === -1) {
      this._providers.push(provider);
    } else {
      this._providers.splice(index, 0, provider);
    }
    return new UniversalDisposable(() => {
      this.removeProvider(provider);
    });
  }

  removeProvider(provider: T): void {
    const index = this._providers.indexOf(provider);
    if (index !== -1) {
      this._providers.splice(index, 1);
    }
  }

  getProviderForEditor(editor: atom$TextEditor): ?T {
    const grammar = editor.getGrammar().scopeName;
    return this.findProvider(grammar);
  }

  getAllProvidersForEditor(editor: atom$TextEditor): Iterable<T> {
    const grammar = editor.getGrammar().scopeName;
    return this.findAllProviders(grammar);
  }

  findProvider(grammar: string): ?T {
    for (const provider of this.findAllProviders(grammar)) {
      return provider;
    }
    return null;
  }

  /**
   * Iterates over all providers matching the grammar, in priority order.
   */
  *findAllProviders(grammar: string): Iterable<T> {
    for (const provider of this._providers) {
      if (
        provider.grammarScopes == null ||
        provider.grammarScopes.indexOf(grammar) !== -1
      ) {
        yield provider;
      }
    }
  }
}
