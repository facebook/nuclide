'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {TypeHintProvider} from './types';
import type {Datatip} from '../../nuclide-datatip/lib/types';

import invariant from 'assert';
import {arrayRemove} from '../../commons-node/collection';
import {track, trackTiming} from '../../nuclide-analytics';
import {makeTypeHintComponent} from './TypeHintComponent';
import {getLogger} from '../../nuclide-logging';

const logger = getLogger();

class TypeHintManager {
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
    const typeHint = await trackTiming(
      name + '.typeHint',
      () => provider.typeHint(editor, position),
    );
    if (!typeHint || this._marker) {
      return;
    }
    const {hint, hintTree, range} = typeHint;
    // For now, actual hint text is required.
    invariant(hint != null);
    // We track the timing above, but we still want to know the number of popups that are shown.
    track('type-hint-popup', {
      scope: scopeName,
      message: hint,
    });
    return {
      component: makeTypeHintComponent(hintTree || hint, grammar),
      range,
    };
  }

  _getMatchingProvidersForScopeName(scopeName: string): Array<TypeHintProvider> {
    return this._typeHintProviders.filter((provider: TypeHintProvider) => {
      const providerGrammars = provider.selector.split(/, ?/);
      return provider.inclusionPriority > 0 && providerGrammars.indexOf(scopeName) !== -1;
    }).sort((providerA: TypeHintProvider, providerB: TypeHintProvider) => {
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

module.exports = TypeHintManager;
