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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  CodeActionProvider,
  CodeFormatProvider,
  DefinitionProvider,
  DefinitionQueryResult,
  LinterProvider,
  OutlineProvider,
} from 'atom-ide-ui';
import type {TypeHintProvider} from '../../nuclide-type-hint/lib/types';
import type {RefactorProvider} from '../../nuclide-refactorizer';
import type {
  ClangConfigurationProvider,
  ClangDeclarationInfoProvider,
} from './types';
import type {RelatedFilesProvider} from '../../nuclide-related-files/lib/types';

import {Disposable} from 'atom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import AutocompleteHelpers from './AutocompleteHelpers';
import CodeActions from './CodeActions';
import CodeFormatHelpers from './CodeFormatHelpers';
import DefinitionHelpers from './DefinitionHelpers';
import OutlineViewHelpers from './OutlineViewHelpers';
import TypeHintHelpers from './TypeHintHelpers';
import Refactoring from './Refactoring';
import ClangLinter from './ClangLinter';
import {GRAMMARS, GRAMMAR_SET, PACKAGE_NAME} from './constants';
import {
  resetForSource,
  registerClangProvider,
  getRelatedSourceOrHeader,
  getDeclarationInfo,
} from './libclang';

let subscriptions: ?UniversalDisposable = null;

export function activate() {
  subscriptions = new UniversalDisposable();
  // Provide a 'Clean and rebuild' command to restart the Clang server for the current file
  // and reset all compilation flags. Useful when BUCK targets or headers change,
  // since those are heavily cached for performance. Also great for testing!
  subscriptions.add(
    atom.commands.add(
      'atom-workspace',
      'nuclide-clang:clean-and-rebuild',
      async () => {
        const editor = atom.workspace.getActiveTextEditor();
        if (editor == null) {
          return;
        }
        const path = editor.getPath();
        if (path == null) {
          return;
        }
        await resetForSource(editor);
        // Save the file to trigger compilation.
        await editor.save();
      },
    ),
  );
}

/** Provider for autocomplete service. */
export function createAutocompleteProvider(): atom$AutocompleteProvider {
  return {
    selector: '.source.objc, .source.objcpp, .source.cpp, .source.c',
    inclusionPriority: 1,
    suggestionPriority: 5, // Higher than the snippets provider.
    getSuggestions(request) {
      return AutocompleteHelpers.getAutocompleteSuggestions(request);
    },
  };
}

export function createTypeHintProvider(): TypeHintProvider {
  return {
    inclusionPriority: 1,
    providerName: PACKAGE_NAME,
    selector: Array.from(GRAMMAR_SET).join(', '),
    typeHint(editor, position) {
      return TypeHintHelpers.typeHint(editor, position);
    },
  };
}

export function provideDefinitions(): DefinitionProvider {
  return {
    name: PACKAGE_NAME,
    priority: 20,
    grammarScopes: GRAMMARS,
    getDefinition(
      editor: TextEditor,
      position: atom$Point,
    ): Promise<?DefinitionQueryResult> {
      return DefinitionHelpers.getDefinition(editor, position);
    },
  };
}

export function provideCodeFormat(): CodeFormatProvider {
  return {
    grammarScopes: Array.from(GRAMMAR_SET),
    priority: 1,
    formatEntireFile(editor, range) {
      return CodeFormatHelpers.formatEntireFile(editor, range);
    },
  };
}

export function provideLinter(): LinterProvider {
  return {
    grammarScopes: Array.from(GRAMMAR_SET),
    scope: 'file',
    lintOnFly: false,
    name: 'Clang',
    lint: editor => ClangLinter.lint(editor),
  };
}

export function provideOutlineView(): OutlineProvider {
  return {
    name: PACKAGE_NAME,
    priority: 10,
    grammarScopes: Array.from(GRAMMAR_SET),
    updateOnEdit: false,
    getOutline(editor) {
      return OutlineViewHelpers.getOutline(editor);
    },
  };
}

export function provideRefactoring(): RefactorProvider {
  return {
    grammarScopes: Array.from(GRAMMAR_SET),
    priority: 1,
    refactoringsAtPoint(editor, point) {
      return Refactoring.refactoringsAtPoint(editor, point);
    },
    refactor(request) {
      return Refactoring.refactor(request);
    },
  };
}

export function provideDeclarationInfo(): ClangDeclarationInfoProvider {
  return {
    getDeclarationInfo,
  };
}

export function provideRelatedFiles(): RelatedFilesProvider {
  return {
    getRelatedFiles(filePath: NuclideUri): Promise<Array<string>> {
      return getRelatedSourceOrHeader(filePath).then(
        related => (related == null ? [] : [related]),
      );
    },
  };
}

export function consumeClangConfigurationProvider(
  provider: ClangConfigurationProvider,
): Disposable {
  return registerClangProvider(provider);
}

export function provideCodeActions(): CodeActionProvider {
  return {
    grammarScopes: Array.from(GRAMMAR_SET),
    priority: 1,
    getCodeActions(editor, range, diagnostics) {
      return CodeActions.getCodeActions(editor, range, diagnostics);
    },
  };
}

export function deactivate() {
  if (subscriptions != null) {
    subscriptions.dispose();
    subscriptions = null;
  }
}
