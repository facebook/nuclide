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

import type {TypeHintProvider} from './types';
import type {Datatip, MarkedString} from 'atom-ide-ui';

import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import analytics from 'nuclide-commons/analytics';
import getFragmentGrammar from 'nuclide-commons-atom/getFragmentGrammar';
import {getLogger} from 'log4js';
import {asyncFind} from 'nuclide-commons/promise';

const logger = getLogger('nuclide-type-hint');

export default class TypeHintManager {
  _providers: ProviderRegistry<TypeHintProvider>;
  /**
   * This helps determine if we should show the type hint when toggling it via
   * command. The toggle command first negates this, and then if this is true
   * shows a type hint, otherwise it hides the current typehint.
   */
  _typeHintToggle: boolean;

  constructor() {
    this._providers = new ProviderRegistry();
  }

  async datatip(editor: TextEditor, position: atom$Point): Promise<?Datatip> {
    const grammar = editor.getGrammar();
    const matchingProviders = [
      ...this._providers.getAllProvidersForEditor(editor),
    ];

    return asyncFind(
      matchingProviders.map(provider =>
        this._getDatatipFromProvider(editor, position, grammar, provider),
      ),
      x => x,
    );
  }

  async _getDatatipFromProvider(
    editor: TextEditor,
    position: atom$Point,
    grammar: atom$Grammar,
    provider: TypeHintProvider,
  ): Promise<?Datatip> {
    if (provider == null) {
      return null;
    }
    let name;
    if (provider.providerName != null) {
      name = provider.providerName;
    } else {
      name = 'unknown';
      logger.error('Type hint provider has no name', provider);
    }
    const typeHint = await analytics.trackTiming(name + '.typeHint', () =>
      provider.typeHint(editor, position),
    );
    // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
    if (!typeHint || this._marker || !typeHint.hint.length === 0) {
      return;
    }
    const {hint, range} = typeHint;
    const {scopeName} = grammar;
    // We track the timing above, but we still want to know the number of popups that are shown.
    analytics.track('type-hint-popup', {
      scope: scopeName,
      message: hint,
    });

    const markedStrings: Array<MarkedString> = hint
      .filter(h => {
        // Ignore all results of length 0. Maybe the next provider will do better?
        return h.value.length > 0;
      })
      .map(h => {
        // Flow doesn't like it when I don't specify these as literals.
        if (h.type === 'snippet') {
          return {
            type: 'snippet',
            value: h.value,
            grammar: getFragmentGrammar(grammar),
          };
        } else {
          return {type: 'markdown', value: h.value};
        }
      });

    if (markedStrings.length === 0) {
      return null;
    }

    return {
      markedStrings,
      range,
    };
  }

  addProvider(provider: TypeHintProvider): IDisposable {
    return this._providers.addProvider(provider);
  }
}
