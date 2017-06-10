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

import type {Datatip, ModifierKey} from '../../nuclide-datatip/lib/types';
import type {DefinitionProvider} from 'atom-ide-ui';

import Immutable from 'immutable';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import {
  getDefinitionPreviewServiceByNuclideUri,
} from '../../nuclide-remote-connection';
import {track, trackTiming} from '../../nuclide-analytics';

function getPlatformKeys(platform) {
  if (platform === 'darwin') {
    return 'nuclide.hyperclick.darwinTriggerKeys';
  } else if (platform === 'win32') {
    return 'nuclide.hyperclick.win32TriggerKeys';
  }
  return 'nuclide.hyperclick.linuxTriggerKeys';
}

export default class HyperclickPreviewManager {
  _definitionProviders: ProviderRegistry<
    DefinitionProvider,
  > = new ProviderRegistry();
  _disposables: UniversalDisposable = new UniversalDisposable();
  _triggerKeys: Set<ModifierKey> = new Set();

  constructor() {
    this._disposables.add(
      atom.config.observe(
        getPlatformKeys(process.platform),
        (newValue: string) => {
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
    heldKeys: Immutable.Set<ModifierKey>,
  ): Promise<?Datatip> {
    if (
      !this._triggerKeys ||
      // are the required keys held down?
      heldKeys.intersect(this._triggerKeys).size !== this._triggerKeys.size
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
    track('hyperclick-preview-popup', {
      grammar: grammar.name,
      definitionCount: definitions.length,
    });

    if (definitions.length === 1) {
      const definition = definitions.pop();
      // Some providers (e.g. Flow) return negative positions.
      if (definition.position.row < 0) {
        return null;
      }

      const {getDefinitionPreview} = getDefinitionPreviewServiceByNuclideUri(
        definition.path,
      );

      const definitionPreview = await trackTiming(
        'hyperclickPreview.getDefinitionPreview',
        () => getDefinitionPreview(definition),
      );
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
}
