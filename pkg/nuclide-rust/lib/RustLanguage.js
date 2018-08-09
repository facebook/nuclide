/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {ServerConnection} from '../../nuclide-remote-connection';
import type {AtomLanguageServiceConfig} from '../../nuclide-language-service/lib/AtomLanguageService';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';

import {
  AtomLanguageService,
  getHostServices,
} from '../../nuclide-language-service';
import {NullLanguageService} from '../../nuclide-language-service-rpc';
import {getNotifierByConnection} from '../../nuclide-open-files';
import {getVSCodeLanguageServiceByConnection} from '../../nuclide-remote-connection';

async function connectionToRustService(
  connection: ?ServerConnection,
): Promise<LanguageService> {
  const [fileNotifier, host] = await Promise.all([
    getNotifierByConnection(connection),
    getHostServices(),
  ]);
  const cmd = 'rls';
  const lspService = await getVSCodeLanguageServiceByConnection(
    connection,
  ).createMultiLspLanguageService(
    'rust',
    cmd,
    [],
    {
      fileNotifier,
      host,
      projectFileNames: ['Cargo.toml'],
      fileExtensions: ['.rs'],
      logCategory: 'nuclide-rust',
      logLevel: 'TRACE',
      useOriginalEnvironment: true,
      additionalLogFilesRetentionPeriod: 5 * 60 * 1000, // 5 minutes
    waitForDiagnostics: true,
    },
  );

  return lspService || new NullLanguageService();
}

async function createLanguageService(): Promise<
  AtomLanguageService<LanguageService>,
> {
  // TODO: Fill in more, already supported features
  const diagnosticsConfig = {
    version: '0.2.0',
    analyticsEventName: 'rust.observe-diagnostics',
  };

  const definitionConfig = {
    version: '0.1.0',
    priority: 1,
    definitionEventName: 'rust.definition',
  };

  const typeHint = {
    version: '0.0.0',
    priority: 1,
    analyticsEventName: 'ocaml.typeHint',
  };

  const autocompleteConfig = {
    inclusionPriority: 1,
    suggestionPriority: 3,
    excludeLowerPriority: false,
    analytics: {
      eventName: 'nuclide-rust',
      shouldLogInsertedSuggestion: false,
    },
    disableForSelector: null,
    autocompleteCacherConfig: null,
    supportsResolve: false,
  };

  const atomConfig: AtomLanguageServiceConfig = {
    name: 'Rust',
    grammars: ['source.rust'],
    diagnostics: diagnosticsConfig,
    definition: definitionConfig,
    autocomplete: autocompleteConfig,
    typeHint: typeHint,
  };
  return new AtomLanguageService(connectionToRustService, atomConfig);
}

export let rustLanguageService: Promise<
  AtomLanguageService<LanguageService>,
> = createLanguageService();

export function resetRustLanguageService(): void {
  rustLanguageService.then(value => value.dispose());
  rustLanguageService = createLanguageService();
}
