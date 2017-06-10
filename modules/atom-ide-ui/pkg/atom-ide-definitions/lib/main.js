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

// This package provides Hyperclick results for any language which provides a
// DefinitionProvider.

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  HyperclickProvider,
  HyperclickSuggestion,
} from '../../hyperclick/lib/types';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';

// position is the first char of the definition's identifier, while range
// includes the entire definition. For example in:
//   class Foo { }
// position should be the 'F' in Foo, while range should span the 'c' in class
// to the '}'
// id is a string which uniquely identifies this symbol in a project. It is not suitable
// for display to humans.
// name is a string suitable for display to humans.
// projectRoot is the root directory of the project containing this definition.
// name is required, and projectRoot is encouraged, when returning multiple results.
export type Definition = {
  path: NuclideUri,
  position: atom$Point,
  range?: atom$Range,
  id?: string,
  name?: string,
  language: string,
  projectRoot?: NuclideUri,
};

// Definition queries supply a point.
// The returned queryRange is the range within which the returned definition is valid.
// Typically queryRange spans the containing identifier around the query point.
export type DefinitionQueryResult = {
  queryRange: Array<atom$Range>,
  definitions: Array<Definition>,
};

// Provides definitions for a set of language grammars.
export type DefinitionProvider = {
  // If there are multiple providers for a given grammar,
  // the one with the highest priority will be used.
  priority: number,
  grammarScopes: Array<string>,
  getDefinition: (
    editor: TextEditor,
    position: atom$Point,
  ) => Promise<?DefinitionQueryResult>,
};

class Activation {
  _providers: ProviderRegistry<DefinitionProvider>;
  _disposables: UniversalDisposable;

  constructor() {
    this._providers = new ProviderRegistry();
    this._disposables = new UniversalDisposable();
  }

  dispose() {
    this._disposables.dispose();
  }

  async getSuggestion(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?HyperclickSuggestion> {
    const provider = this._providers.getProviderForEditor(editor);
    if (provider == null) {
      return null;
    }
    const result = await provider.getDefinition(editor, position);
    if (result == null) {
      return null;
    }
    const {definitions} = result;
    invariant(definitions.length > 0);

    function createCallback(definition) {
      return () => {
        goToLocation(
          definition.path,
          definition.position.row,
          definition.position.column,
        );
      };
    }

    function createTitle(definition) {
      invariant(
        definition.name != null,
        'must include name when returning multiple definitions',
      );
      const filePath = definition.projectRoot == null
        ? definition.path
        : nuclideUri.relative(definition.projectRoot, definition.path);
      return `${definition.name} (${filePath})`;
    }

    if (definitions.length === 1) {
      return {
        range: result.queryRange,
        callback: createCallback(definitions[0]),
      };
    } else {
      return {
        range: result.queryRange,
        callback: definitions.map(definition => {
          return {
            title: createTitle(definition),
            callback: createCallback(definition),
          };
        }),
      };
    }
  }

  consumeDefinitionProvider(provider: DefinitionProvider): IDisposable {
    const disposable = this._providers.addProvider(provider);
    this._disposables.add(disposable);
    return disposable;
  }

  getHyperclickProvider(): HyperclickProvider {
    return {
      priority: 20,
      providerName: 'atom-ide-definitions',
      getSuggestion: (editor, position) => this.getSuggestion(editor, position),
    };
  }
}

createPackage(module.exports, Activation);
