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

import type {LinterProvider, RegisterIndieLinter} from 'atom-ide-ui';
import type {BuckTaskRunnerService} from '../../nuclide-buck/lib/types';
import type {PlatformService} from '../../nuclide-buck/lib/PlatformService';
import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';
import type {AtomLanguageServiceConfig} from '../../nuclide-language-service/lib/AtomLanguageService';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';

import passesGK from 'nuclide-commons/passesGK';
import {GRAMMARS, GRAMMAR_SET} from './constants';
import LinkTreeLinter from './LinkTreeLinter';
import LintHelpers from './LintHelpers';
import {
  getPythonServiceByConnection,
  ServerConnection,
} from '../../nuclide-remote-connection';
import {getNotifierByConnection} from '../../nuclide-open-files';
import {
  AtomLanguageService,
  updateAutocompleteFirstResults,
  updateAutocompleteResults,
} from '../../nuclide-language-service';
import createPackage from 'nuclide-commons-atom/createPackage';
import {
  getShowGlobalVariables,
  getShowSignatureHelp,
  getAutocompleteArguments,
  getIncludeOptionalArguments,
} from './config';
import {providePythonPlatformGroup} from './pythonPlatform';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

async function connectionToPythonService(
  connection: ?ServerConnection,
): Promise<LanguageService> {
  const pythonService = getPythonServiceByConnection(connection);
  const fileNotifier = await getNotifierByConnection(connection);
  const languageService = await pythonService.initialize(fileNotifier, {
    showGlobalVariables: getShowGlobalVariables(),
    autocompleteArguments: getAutocompleteArguments(),
    includeOptionalArguments: getIncludeOptionalArguments(),
  });

  return languageService;
}

function getAtomConfig(): AtomLanguageServiceConfig {
  return {
    name: 'Python',
    grammars: GRAMMARS,
    outline: {
      version: '0.1.0',
      priority: 1,
      analyticsEventName: 'python.outline',
    },
    codeFormat: {
      version: '0.1.0',
      priority: 1,
      analyticsEventName: 'python.formatCode',
      canFormatRanges: false,
      canFormatAtPosition: false,
    },
    findReferences: {
      version: '0.1.0',
      analyticsEventName: 'python.get-references',
    },
    autocomplete: {
      inclusionPriority: 5,
      suggestionPriority: 5, // Higher than the snippets provider.
      disableForSelector: '.source.python .comment, .source.python .string',
      excludeLowerPriority: false,
      analytics: {
        eventName: 'nuclide-python',
        shouldLogInsertedSuggestion: false,
      },
      autocompleteCacherConfig: {
        updateResults: updateAutocompleteResults,
        updateFirstResults: updateAutocompleteFirstResults,
      },
      supportsResolve: false,
    },
    definition: {
      version: '0.1.0',
      priority: 20,
      definitionEventName: 'python.get-definition',
    },
    typeHint: {
      version: '0.0.0',
      priority: 5,
      analyticsEventName: 'python.hover',
    },
    signatureHelp: getShowSignatureHelp()
      ? {
          version: '0.1.0',
          priority: 1,
          triggerCharacters: new Set(['(', ',']),
          analyticsEventName: 'python.signatureHelp',
        }
      : undefined,
  };
}

function resetServices(): void {
  getPythonServiceByConnection(null).reset();
  ServerConnection.getAllConnections().forEach(conn => {
    getPythonServiceByConnection(conn).reset();
  });
}

class Activation {
  _linkTreeLinter: LinkTreeLinter;
  _subscriptions: UniversalDisposable;

  constructor() {
    this._subscriptions = new UniversalDisposable();
    this._linkTreeLinter = new LinkTreeLinter();

    this._initLanguageServer();
  }

  async _initLanguageServer(): Promise<void> {
    if (await passesGK('nuclide_fb_pyls_vscode_ext')) {
      return;
    }
    const pythonLanguageService = new AtomLanguageService(
      connectionToPythonService,
      getAtomConfig(),
    );
    pythonLanguageService.activate();
    this._subscriptions.add(
      this._provideLint(),
      pythonLanguageService,
      atom.commands.add(
        'atom-workspace',
        'nuclide-python:reset-language-services',
        resetServices,
      ),
    );
  }

  _provideLint(): IDisposable {
    const lintProvier: LinterProvider = {
      grammarScopes: Array.from(GRAMMAR_SET),
      scope: 'file',
      name: 'flake8',
      lint: editor => LintHelpers.lint(editor),
    };

    return atom.packages.serviceHub.provide('linter', '1.0.0', lintProvier);
  }

  consumeLinterIndie(register: RegisterIndieLinter): IDisposable {
    const linter = register({name: 'Python'});
    const disposable = new UniversalDisposable(
      linter,
      this._linkTreeLinter
        .observeMessages()
        .subscribe(messages => linter.setAllMessages(messages)),
    );
    this._subscriptions.add(disposable);
    return new UniversalDisposable(disposable, () =>
      this._subscriptions.remove(disposable),
    );
  }

  consumePlatformService(service: PlatformService): IDisposable {
    const disposable = service.register(providePythonPlatformGroup);
    this._subscriptions.add(disposable);
    return new UniversalDisposable(() => {
      this._subscriptions.remove(disposable);
    });
  }

  consumeBuckTaskRunner(service: BuckTaskRunnerService): IDisposable {
    return this._linkTreeLinter.consumeBuckTaskRunner(service);
  }

  consumeCwdApi(api: CwdApi): IDisposable {
    return this._linkTreeLinter.consumeCwdApi(api);
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}

createPackage(module.exports, Activation);
