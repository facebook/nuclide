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

// $FlowFB
import type {ProjectSymbolSearchProvider} from '../../fb-go-to-project-symbol-dash-provider/lib/types';
import type {OnDidInsertSuggestionArgument} from '../../nuclide-language-service/lib/AutocompleteProvider';
import type {CodeActionConfig} from '../../nuclide-language-service/lib/CodeActionProvider';
import type {
  GlobalProviderType,
  SymbolResult,
} from '../../nuclide-quick-open/lib/types';
import type {ServerConnection} from '../../nuclide-remote-connection';
import type {AtomLanguageServiceConfig} from '../../nuclide-language-service/lib/AtomLanguageService';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';

import createPackage from 'nuclide-commons-atom/createPackage';
import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import {applyTextEditsToBuffer} from 'nuclide-commons-atom/text-edit';
import {track} from 'nuclide-analytics';
import * as convert from '../../nuclide-vscode-language-service-rpc/lib/convert';
import {
  AtomLanguageService,
  getHostServices,
} from '../../nuclide-language-service';
import {NullLanguageService} from '../../nuclide-language-service-rpc';
import {
  getNotifierByConnection,
  getFileVersionOfEditor,
} from '../../nuclide-open-files';
import {getVSCodeLanguageServiceByConnection} from '../../nuclide-remote-connection';
import featureConfig from 'nuclide-commons-atom/feature-config';
import QuickOpenProvider from './QuickOpenProvider';
import JSSymbolSearchProvider from './JSSymbolSearchProvider';
import DashProjectSymbolProvider from './DashProjectSymbolProvider';

async function connectToJSImportsService(
  connection: ?ServerConnection,
): Promise<LanguageService> {
  const [fileNotifier, host] = await Promise.all([
    getNotifierByConnection(connection),
    getHostServices(),
  ]);

  const service = getVSCodeLanguageServiceByConnection(connection);
  const lspService = await service.createMultiLspLanguageService(
    'jsimports',
    './pkg/nuclide-js-imports-server/src/index-entry.js',
    [],
    {
      fileNotifier,
      host,
      logCategory: 'jsimports',
      logLevel: (featureConfig.get('nuclide-js-imports-client.logLevel'): any),
      projectFileNames: ['.flowconfig'],
      fileExtensions: ['.js', '.jsx'],
      initializationOptions: getAutoImportSettings(),
      fork: true,
    },
  );
  return lspService || new NullLanguageService();
}

function createLanguageService(): AtomLanguageService<LanguageService> {
  const diagnosticsConfig = {
    version: '0.2.0',
    analyticsEventName: 'jsimports.observe-diagnostics',
  };

  const autocompleteConfig = {
    inclusionPriority: 1,
    suggestionPriority: 3,
    excludeLowerPriority: false,
    analytics: {
      eventName: 'nuclide-js-imports',
      shouldLogInsertedSuggestion: true,
    },
    disableForSelector: null,
    autocompleteCacherConfig: null,
    supportsResolve: false,
  };

  const codeActionConfig: CodeActionConfig = {
    version: '0.1.0',
    priority: 0,
    analyticsEventName: 'jsimports.codeAction',
    applyAnalyticsEventName: 'jsimports.applyCodeAction',
  };

  const atomConfig: AtomLanguageServiceConfig = {
    name: 'JSAutoImports',
    grammars: ['source.js.jsx', 'source.js', 'source.flow'],
    diagnostics: diagnosticsConfig,
    autocomplete: autocompleteConfig,
    codeAction: codeActionConfig,
    typeHint: {
      version: '0.0.0',
      priority: 0.1,
      analyticsEventName: 'jsimports.typeHint',
    },
  };
  return new AtomLanguageService(
    connectToJSImportsService,
    atomConfig,
    onDidInsertSuggestion,
  );
}

function onDidInsertSuggestion({
  suggestion,
}: OnDidInsertSuggestionArgument): void {
  const {
    description,
    displayText,
    extraData,
    remoteUri,
    replacementPrefix,
    snippet,
    text,
    type,
  } = suggestion;
  track('nuclide-js-imports:insert-suggestion', {
    suggestion: {
      description,
      displayText,
      extraData,
      remoteUri,
      replacementPrefix,
      snippet,
      text,
      type,
    },
  });
}

function getAutoImportSettings() {
  // Currently, we will get the settings when the package is initialized. This
  // means that the user would need to restart Nuclide for a change in their
  // settings to take effect. In the future, we would most likely want to observe
  // their settings and send DidChangeConfiguration requests to the server.
  // TODO: Observe settings changes + send to the server.
  return {
    componentModulePathFilter: featureConfig.get(
      'nuclide-js-imports-client.componentModulePathFilter',
    ),
    diagnosticsWhitelist: featureConfig.get(
      'nuclide-js-imports-client.diagnosticsWhitelist',
    ),
    requiresWhitelist: featureConfig.get(
      'nuclide-js-imports-client.requiresWhitelist',
    ),
  };
}

class Activation {
  _languageService: AtomLanguageService<LanguageService>;
  _quickOpenProvider: QuickOpenProvider;
  _commandSubscription: UniversalDisposable;

  constructor() {
    this._languageService = createLanguageService();
    this._languageService.activate();
    this._quickOpenProvider = new QuickOpenProvider(this._languageService);
    this._commandSubscription = new UniversalDisposable();
  }

  provideProjectSymbolSearch(): ProjectSymbolSearchProvider {
    return new DashProjectSymbolProvider(this._languageService);
  }

  provideJSSymbolSearchService(): JSSymbolSearchProvider {
    return new JSSymbolSearchProvider(this._languageService);
  }

  dispose() {
    this._languageService.dispose();
    this._commandSubscription.dispose();
  }

  registerQuickOpenProvider(): GlobalProviderType<SymbolResult> {
    return this._quickOpenProvider;
  }

  consumeOrganizeRequiresService(
    organizeRequires: ({
      addedRequires: boolean,
      missingExports: boolean,
    }) => void,
  ): UniversalDisposable {
    this._commandSubscription.add(
      atom.commands.add(
        'atom-text-editor',
        'nuclide-js-imports:auto-require',
        async () => {
          const editor = atom.workspace.getActiveTextEditor();
          if (editor == null) {
            return;
          }
          const editorPath = editor.getPath();
          const fileVersion = await getFileVersionOfEditor(editor);
          if (fileVersion == null || editorPath == null) {
            return;
          }
          const buffer = editor.getBuffer();
          const languageService: ?LanguageService = await this._languageService.getLanguageServiceForUri(
            editorPath,
          );
          if (languageService == null) {
            return;
          }

          const beforeEditsCheckpoint = buffer.createCheckpoint();
          const {
            edits,
            addedRequires,
            missingExports,
          } = (await languageService.sendLspRequest(
            editorPath,
            'workspace/executeCommand',
            {
              command: 'getAllImports',
              arguments: [nuclideUri.getPath(editorPath)],
            },
          ): any);
          if (
            !applyTextEditsToBuffer(
              buffer,
              convert.lspTextEdits_atomTextEdits(edits || []),
            )
          ) {
            // TODO(T24077432): Show the error to the user
            throw new Error('Could not apply edits to text buffer.');
          }
          // Then use nuclide-format-js to properly format the imports
          organizeRequires({
            addedRequires,
            missingExports,
          });
          buffer.groupChangesSinceCheckpoint(beforeEditsCheckpoint);
        },
      ),
    );
    return this._commandSubscription;
  }
}

createPackage(module.exports, Activation);
