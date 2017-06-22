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

import type {Datatip, ModifierKey} from '../../atom-ide-datatip';

import type {
  Definition,
  DefinitionProvider,
  DefinitionPreviewProvider,
} from '../../atom-ide-definitions';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import analytics from 'nuclide-commons-atom/analytics';
import featureConfig from 'nuclide-commons-atom/feature-config';

import {
  getDefinitionPreview as getLocalFileDefinitionPreview,
} from 'nuclide-commons/symbol-definition-preview';

function getPlatformKeys(platform) {
  if (platform === 'darwin') {
    return 'hyperclick.darwinTriggerKeys';
  } else if (platform === 'win32') {
    return 'hyperclick.win32TriggerKeys';
  }
  return 'hyperclick.linuxTriggerKeys';
}

export default class HyperclickPreviewManager {
  _definitionProviders: ProviderRegistry<
    DefinitionProvider,
  > = new ProviderRegistry();
  _definitionPreviewProvider: ?DefinitionPreviewProvider;
  _disposables: UniversalDisposable = new UniversalDisposable();
  _triggerKeys: Set<ModifierKey> = new Set();

  constructor() {
    this._disposables.add(
      featureConfig.observe(
        getPlatformKeys(process.platform),
        (newValue: any) => {
          this._triggerKeys = (new Set(newValue.split(',')): Set<any>);
        },
      ),
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  async modifierDatatip(
    editor: TextEditor,
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

    const grammar = editor.getGrammar();
    const definitionProvider = this._definitionProviders.getProviderForEditor(
      editor,
    );
    if (definitionProvider == null) {
      return null;
    }

    const result = await definitionProvider.getDefinition(editor, position);
    if (result == null) {
      return null;
    }

    const {queryRange, definitions} = result;
    analytics.track('hyperclick-preview-popup', {
      grammar: grammar.name,
      definitionCount: definitions.length,
    });

    if (definitions.length === 1) {
      const definition = definitions.pop();
      // Some providers (e.g. Flow) return negative positions.
      if (definition.position.row < 0) {
        return null;
      }

      const definitionPreview = await this.getDefinitionPreview(definition);
      return {
        markedStrings: [
          {
            type: 'snippet',
            value: definitionPreview,
            grammar,
          },
        ],
        range: queryRange[0],
      };
    }

    return {
      markedStrings: [
        {
          type: 'markdown',
          value: `${definitions.length} definitions found. Click to jump.`,
          grammar,
        },
      ],
      range: queryRange[0],
    };
  }

  consumeDefinitionProvider(provider: DefinitionProvider): IDisposable {
    const disposable = this._definitionProviders.addProvider(provider);
    this._disposables.add(disposable);
    return disposable;
  }

  consumeDefinitionPreviewProvider(provider: DefinitionPreviewProvider) {
    this._definitionPreviewProvider = provider;
  }

  async getDefinitionPreview(definition: Definition) {
    let getDefinitionPreviewFn;
    if (this._definitionPreviewProvider) {
      getDefinitionPreviewFn = this._definitionPreviewProvider.getDefinitionPreview.bind(
        this._definitionPreviewProvider,
      );
    } else {
      getDefinitionPreviewFn = getLocalFileDefinitionPreview;
    }

    return analytics.trackTiming('hyperclickPreview.getDefinitionPreview', () =>
      getDefinitionPreviewFn(definition),
    );
  }
}
