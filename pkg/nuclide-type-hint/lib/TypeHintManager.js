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
import type {Datatip} from '../../nuclide-datatip/lib/types';

import analytics from 'nuclide-commons-atom/analytics';
import {arrayRemove} from 'nuclide-commons/collection';
import {getLogger} from 'log4js';

const logger = getLogger('nuclide-type-hint');

export default class TypeHintManager {
  _typeHintProviders: Array<TypeHintProvider>;
  /**
   * This helps determine if we should show the type hint when toggling it via
   * command. The toggle command first negates this, and then if this is true
   * shows a type hint, otherwise it hides the current typehint.
   */
  _typeHintToggle: boolean;

  constructor() {
    this._typeHintProviders = [];
  }

  async datatip(editor: TextEditor, position: atom$Point): Promise<?Datatip> {
    const grammar = editor.getGrammar();
    const {scopeName} = grammar;
    const [provider] = this._getMatchingProvidersForScopeName(scopeName);
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
    if (!typeHint || this._marker) {
      return;
    }
    const {hint, range} = typeHint;
    // We track the timing above, but we still want to know the number of popups that are shown.
    analytics.track('type-hint-popup', {
      scope: scopeName,
      message: hint,
    });
    return {
      markedStrings: [{type: 'snippet', value: hint, grammar}],
      range,
    };
  }

  _getMatchingProvidersForScopeName(
    scopeName: string,
  ): Array<TypeHintProvider> {
    return this._typeHintProviders
      .filter((provider: TypeHintProvider) => {
        const providerGrammars = provider.selector.split(/, ?/);
        return (
          provider.inclusionPriority > 0 &&
          providerGrammars.indexOf(scopeName) !== -1
        );
      })
      .sort((providerA: TypeHintProvider, providerB: TypeHintProvider) => {
        return providerA.inclusionPriority - providerB.inclusionPriority;
      });
  }

  addProvider(provider: TypeHintProvider) {
    this._typeHintProviders.push(provider);
  }

  removeProvider(provider: TypeHintProvider): void {
    arrayRemove(this._typeHintProviders, provider);
  }
}
