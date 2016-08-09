'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {LinterProvider} from '../../nuclide-diagnostics-common';
import type {OutlineProvider} from '../../nuclide-outline-view/lib/main';
import type {TypeHintProvider as TypeHintProviderType} from '../../nuclide-type-hint/lib/types';

import {trackOperationTiming} from '../../nuclide-analytics';
import HyperclickProvider from './HyperclickProvider';
import AutoComplete from './AutoComplete';
import {GRAMMARS} from './constants';
import MerlinLinterProvider from './LinterProvider';
import {getOutline} from './OutlineProvider';
import TypeHintProvider from './TypeHintProvider';

export function getHyperclickProvider() {
  return HyperclickProvider;
}

export function createAutocompleteProvider(): mixed {
  const getSuggestions = request => {
    return trackOperationTiming(
      'nuclide-ocaml:getAutocompleteSuggestions',
      () => AutoComplete.getAutocompleteSuggestions(request));
  };
  return {
    selector: '.source.ocaml',
    inclusionPriority: 1,
    disableForSelector: '.source.ocaml .comment',
    getSuggestions,
  };
}

export function provideLinter(): LinterProvider {
  return MerlinLinterProvider;
}

export function provideOutlines(): OutlineProvider {
  return {
    grammarScopes: Array.from(GRAMMARS),
    priority: 1,
    name: 'OCaml',
    getOutline,
  };
}

export function createTypeHintProvider(): TypeHintProviderType {
  const typeHintProvider = new TypeHintProvider();
  const typeHint = typeHintProvider.typeHint.bind(typeHintProvider);

  return {
    inclusionPriority: 1,
    providerName: 'nuclide-ocaml',
    selector: Array.from(GRAMMARS).join(', '),
    typeHint,
  };
}
