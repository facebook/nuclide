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

import type {
  CodeFormatProvider,
  LinterProvider,
  OutlineProvider,
} from 'atom-ide-ui';
import type {TypeHintProvider as TypeHintProviderType} from '../../nuclide-type-hint/lib/types';

import {trackTiming} from '../../nuclide-analytics';
import HyperclickProvider from './HyperclickProvider';
import AutoComplete from './AutoComplete';
import {GRAMMARS} from './constants';
import MerlinLinterProvider from './LinterProvider';
import {getOutline} from './OutlineProvider';
import TypeHintProvider from './TypeHintProvider';
import {cases} from './DestructureHelpers';
import {getEntireFormatting} from './CodeFormatHelpers';
import {CompositeDisposable} from 'atom';
import {createLanguageService} from './OCamlLanguage';
import {getUseLspConnection} from '../../nuclide-ocaml-rpc/lib/OCamlService';

export function getHyperclickProvider() {
  return HyperclickProvider;
}

export function createAutocompleteProvider(): mixed {
  const getSuggestions = request => {
    return trackTiming('nuclide-ocaml:getAutocompleteSuggestions', () =>
      AutoComplete.getAutocompleteSuggestions(request),
    );
  };
  return {
    selector: '.source.ocaml, .source.reason',
    inclusionPriority: 1,
    disableForSelector: '.source.ocaml .comment, .source.reason .comment',
    getSuggestions,
  };
}

export function provideLinter(): LinterProvider {
  return MerlinLinterProvider;
}

export function provideOutlines(): OutlineProvider {
  // TODO: (chenglou) get back the ability to output Reason outline.
  return {
    grammarScopes: Array.from(GRAMMARS),
    priority: 1,
    name: 'OCaml',
    getOutline: editor => getOutline(editor),
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

export function createCodeFormatProvider(): CodeFormatProvider {
  return {
    grammarScopes: Array.from(GRAMMARS),
    priority: 1,
    formatEntireFile: (editor, range) => getEntireFormatting(editor, range),
  };
}

let disposables: atom$CompositeDisposable = new CompositeDisposable();

export async function activate(): Promise<void> {
  if (await getUseLspConnection()) {
    const ocamlLspLanguageService = createLanguageService();
    ocamlLspLanguageService.activate();
    disposables.add(ocamlLspLanguageService);
  } else {
    disposables.add(
      atom.commands.add('atom-workspace', 'nuclide-ocaml:destructure', () => {
        const editor = atom.workspace.getActiveTextEditor();
        if (editor) {
          cases(editor, editor.getCursorScreenPosition());
        }
      }),
      atom.packages.serviceHub.provide(
        'outline-view',
        '0.1.0',
        provideOutlines(),
      ),
      atom.packages.serviceHub.provide(
        'nuclide-type-hint.provider',
        '0.0.0',
        createTypeHintProvider(),
      ),
      atom.packages.serviceHub.provide(
        'autocomplete.provider',
        '2.0.0',
        createAutocompleteProvider(),
      ),
      atom.packages.serviceHub.provide(
        'hyperclick',
        '0.1.0',
        getHyperclickProvider(),
      ),
      atom.packages.serviceHub.provide('linter', '1.0.0', provideLinter()),
      atom.packages.serviceHub.provide(
        'code-format.file',
        '0.1.0',
        createCodeFormatProvider(),
      ),
    );
  }
}

export async function deactivate(): Promise<void> {
  disposables.dispose();
  disposables = new CompositeDisposable();
}
