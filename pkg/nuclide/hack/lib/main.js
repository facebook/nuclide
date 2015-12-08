'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {Point} from 'atom';

import CodeHighlightProvider from './CodeHighlightProvider';
import {CompositeDisposable} from 'atom';
import {HACK_GRAMMARS} from 'nuclide-hack-common/lib/constants';

const HACK_GRAMMARS_STRING = HACK_GRAMMARS.join(', ');
const PACKAGE_NAME = 'nuclide-hack';

// One of text or snippet is required.
type Suggestion = {
  text: ?string;
  snippet: ?string;
  replacementPrefix: ?string;
  rightLabel: ?string;
  rightLabelHTML: ?string;
  className: ?string;
};

let subscriptions: ?CompositeDisposable = null;
let hackDiagnosticsProvider;
let busySignalProvider;

module.exports = {

  activate() {
    const {getCachedHackLanguageForUri} = require('./hack');
    const {projects} = require('nuclide-atom-helpers');
    subscriptions = new CompositeDisposable();
    subscriptions.add(projects.onDidRemoveProjectPath(projectPath => {
      const hackLanguage = getCachedHackLanguageForUri(projectPath);
      if (hackLanguage) {
        hackLanguage.dispose();
      }
      if (hackDiagnosticsProvider) {
        hackDiagnosticsProvider.invalidateProjectPath(projectPath);
      }
    }));
  },

  /** Provider for autocomplete service. */
  createAutocompleteProvider() {
    const AutocompleteProvider = require('./AutocompleteProvider');
    const autocompleteProvider = new AutocompleteProvider();

    return {
      selector: HACK_GRAMMARS.map(grammar => '.' + grammar).join(', '),
      inclusionPriority: 1,
      suggestionPriority: 3, // The context-sensitive hack autocompletions are more relevant than snippets.
      excludeLowerPriority: false,

      getSuggestions(
          request: {editor: TextEditor; bufferPosition: Point; scopeDescriptor: any; prefix: string}
          ): Promise<Array<Suggestion>> {
        return autocompleteProvider.getAutocompleteSuggestions(request);
      },
    };
  },

  getHyperclickProvider(): HyperclickProvider {
    const HackHyperclickProvider = require('./HyperclickProvider');
    const hackHyperclickProvider = new HackHyperclickProvider();
    const getSuggestionForWord =
        hackHyperclickProvider.getSuggestionForWord.bind(hackHyperclickProvider);
    return {
      priority: 20,
      providerName: PACKAGE_NAME,
      getSuggestionForWord,
    };
  },

  /** Provider for code format service. */
  createCodeFormatProvider(): any {
    const CodeFormatProvider = require('./CodeFormatProvider');
    const codeFormatProvider = new CodeFormatProvider();

    return {
      selector: HACK_GRAMMARS_STRING,
      inclusionPriority: 1,

      formatCode(editor: TextEditor, range: Range): Promise<string> {
        return codeFormatProvider.formatCode(editor, range);
      },
    };
  },

  createFindReferencesProvider(): any {
    return require('./FindReferencesProvider');
  },

  createTypeHintProvider(): any {
    const TypeHintProvider = require('./TypeHintProvider');
    const typeHintProvider = new TypeHintProvider();

    return {
      selector: HACK_GRAMMARS_STRING,
      inclusionPriority: 1,
      providerName: PACKAGE_NAME,

      typeHint(editor: TextEditor, position: Point): Promise<string> {
        return typeHintProvider.typeHint(editor, position);
      },
    };
  },

  createCodeHighlightProvider(): any {
    const codeHighlightProvider = new CodeHighlightProvider();

    return {
      selector: HACK_GRAMMARS_STRING,
      inclusionPriority: 1,
      highlight(editor: atom$TextEditor, position: atom$Point): Promise<Array<atom$Range>> {
        return codeHighlightProvider.highlight(editor, position);
      },
    };
  },

  provideBusySignal(): BusySignalProviderBase {
    if (busySignalProvider == null) {
      const {BusySignalProviderBase} = require('nuclide-busy-signal-provider-base');
      busySignalProvider = new BusySignalProviderBase();
    }
    return busySignalProvider;
  },

  provideDiagnostics() {
    if (!hackDiagnosticsProvider) {
      const HackDiagnosticsProvider = require('./HackDiagnosticsProvider');
      const busyProvider = this.provideBusySignal();
      hackDiagnosticsProvider = new HackDiagnosticsProvider(false, busyProvider);
    }
    return hackDiagnosticsProvider;
  },

  deactivate(): void {
    if (subscriptions) {
      subscriptions.dispose();
      subscriptions = null;
    }
    if (hackDiagnosticsProvider) {
      hackDiagnosticsProvider.dispose();
      hackDiagnosticsProvider = null;
    }
  },
};
