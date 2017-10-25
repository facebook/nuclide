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

// This package provides Hyperclick results for any language which provides a
// DefinitionProvider.

import type {
  HyperclickProvider,
  HyperclickSuggestion,
} from '../../hyperclick/lib/types';

import type {
  Datatip,
  DatatipService,
  ModifierDatatipProvider,
  ModifierKey,
} from '../../atom-ide-datatip/lib/types';

import type {
  DefinitionQueryResult,
  DefinitionProvider,
  DefinitionPreviewProvider,
} from './types';

import invariant from 'assert';
import {getLogger} from 'log4js';
import {Range} from 'atom';

import analytics from 'nuclide-commons-atom/analytics';
import createPackage from 'nuclide-commons-atom/createPackage';
import FeatureConfig from 'nuclide-commons-atom/feature-config';
import {wordAtPosition} from 'nuclide-commons-atom/range';
import nuclideUri from 'nuclide-commons/nuclideUri';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';

import DefinitionCache from './DefinitionCache';
import getPreviewDatatipFromDefinitionResult from './getPreviewDatatipFromDefinitionResult';

class Activation {
  _providers: ProviderRegistry<DefinitionProvider>;
  _definitionPreviewProvider: ?DefinitionPreviewProvider;
  _definitionCache: DefinitionCache;
  _disposables: UniversalDisposable;
  _triggerKeys: Set<ModifierKey>;

  constructor() {
    this._providers = new ProviderRegistry();
    this._definitionCache = new DefinitionCache();
    this._triggerKeys = new Set();

    this._disposables = new UniversalDisposable(
      FeatureConfig.observe(
        getPlatformKeys(process.platform),
        (newValue: ?string) => {
          this._triggerKeys = (new Set(
            // flowlint-next-line sketchy-null-string:off
            newValue ? newValue.split(',') : null,
          ): Set<any>);
        },
      ),
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  async _getDefinition(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?DefinitionQueryResult> {
    for (const provider of this._providers.getAllProvidersForEditor(editor)) {
      try {
        // eslint-disable-next-line no-await-in-loop
        const result = await provider.getDefinition(editor, position);
        if (result != null) {
          if (result.queryRange == null) {
            const match = wordAtPosition(editor, position, {
              includeNonWordCharacters: false,
            });
            result.queryRange = [
              match != null ? match.range : new Range(position, position),
            ];
          }
          return result;
        }
      } catch (err) {
        getLogger('atom-ide-definitions').error(
          `Error getting definition for ${String(editor.getPath())}`,
          err,
        );
      }
    }
    return null;
  }

  async getSuggestion(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?HyperclickSuggestion> {
    const result = await this._definitionCache.get(editor, position, () =>
      this._getDefinition(editor, position),
    );

    if (result == null) {
      return null;
    }

    const {queryRange, definitions} = result;
    invariant(definitions.length > 0);
    // queryRange might be null coming out of the provider, but the output
    // of _getDefinition has ensured it's not null.
    invariant(queryRange != null);

    function createCallback(definition) {
      return () => {
        goToLocation(definition.path, {
          line: definition.position.row,
          column: definition.position.column,
        });
      };
    }

    function createTitle(definition) {
      const filePath =
        definition.projectRoot == null
          ? definition.path
          : nuclideUri.relative(definition.projectRoot, definition.path);
      if (definition.name == null) {
        // Fall back to just displaying the path:line.
        return `${filePath}:${definition.position.row + 1}`;
      }
      return `${definition.name} (${filePath})`;
    }

    if (definitions.length === 1) {
      return {
        range: queryRange,
        callback: createCallback(definitions[0]),
      };
    } else {
      return {
        range: queryRange,
        callback: definitions.map(definition => {
          return {
            title: createTitle(definition),
            callback: createCallback(definition),
          };
        }),
      };
    }
  }

  async getPreview(
    editor: atom$TextEditor,
    position: atom$Point,
    heldKeys: Set<ModifierKey>,
  ): Promise<?Datatip> {
    if (
      !this._triggerKeys ||
      // are the required keys held down?
      !Array.from(this._triggerKeys).every(key => heldKeys.has(key))
    ) {
      return;
    }

    const result = await this._getDefinition(editor, position);
    if (result == null) {
      return null;
    }
    const queryRange = result.queryRange;
    // queryRange might be null coming out of the provider, but the output
    // of _getDefinition has ensured it's not null.
    invariant(queryRange != null);

    const grammar = editor.getGrammar();
    const previewDatatip = getPreviewDatatipFromDefinitionResult(
      queryRange[0],
      result.definitions,
      this._definitionPreviewProvider,
      grammar,
    );

    // flowlint-next-line sketchy-null-mixed:off
    if (previewDatatip != null && previewDatatip.markedStrings) {
      analytics.track('hyperclick-preview-popup', {
        grammar: grammar.name,
        definitionCount: result.definitions.length,
      });
    }

    return previewDatatip;
  }

  consumeDefinitionProvider(provider: DefinitionProvider): IDisposable {
    const disposable = this._providers.addProvider(provider);
    this._disposables.add(disposable);
    return disposable;
  }

  consumeDefinitionPreviewProvider(provider: DefinitionPreviewProvider) {
    this._definitionPreviewProvider = provider;
  }

  consumeDatatipService(service: DatatipService): IDisposable {
    const datatipProvider: ModifierDatatipProvider = {
      providerName: 'hyperclick-preview',
      priority: 1,
      modifierDatatip: (
        editor: atom$TextEditor,
        bufferPosition: atom$Point,
        heldKeys: Set<ModifierKey>,
      ) => this.getPreview(editor, bufferPosition, heldKeys),
    };

    const disposable = service.addModifierProvider(datatipProvider);
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

function getPlatformKeys(platform) {
  if (platform === 'darwin') {
    return 'hyperclick.darwinTriggerKeys';
  } else if (platform === 'win32') {
    return 'hyperclick.win32TriggerKeys';
  }
  return 'hyperclick.linuxTriggerKeys';
}

createPackage(module.exports, Activation);
