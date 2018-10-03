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

import type {ServerConnection} from '../../nuclide-remote-connection';
import type {AtomLanguageServiceConfig} from '../../nuclide-language-service/lib/AtomLanguageService';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';

import featureConfig from 'nuclide-commons-atom/feature-config';
import {
  AtomLanguageService,
  getHostServices,
} from '../../nuclide-language-service';
import {NullLanguageService} from '../../nuclide-language-service-rpc';
import {getNotifierByConnection} from '../../nuclide-open-files';
import {getVSCodeLanguageServiceByConnection} from '../../nuclide-remote-connection';

export function getRlsPath(): string {
  return (featureConfig.get('nuclide-rust.rlsPath'): any);
}

async function connectionToRustService(
  connection: ?ServerConnection,
): Promise<LanguageService> {
  const [fileNotifier, host] = await Promise.all([
    getNotifierByConnection(connection),
    getHostServices(),
  ]);
  const service = getVSCodeLanguageServiceByConnection(connection);

  const lspService = await service.createMultiLspLanguageService(
    'rust',
    getRlsPath(),
    [],
    {
      fileNotifier,
      host,
      projectFileNames: ['Cargo.toml', '.buckconfig'],
      fileExtensions: ['.rs'],
      logCategory: 'nuclide-rust',
      logLevel: 'TRACE',
      useOriginalEnvironment: true,
      additionalLogFilesRetentionPeriod: 5 * 60 * 1000, // 5 minutes
      waitForDiagnostics: true,
      initializationOptions: {
        // Don't let RLS eagerly build (and fail crashing while finding a
        // Cargo.toml if the project uses Buck) for now.
        // TODO: Pass initial config (at least the `build_command`).
        // https://github.com/rust-lang-nursery/rls/issues/1026
        // Without this the RLS can still can crash when the user starts
        // modifying .rs files.
        omitInitBuild: true,
      },
    },
  );

  return lspService || new NullLanguageService();
}

export const atomConfig: AtomLanguageServiceConfig = {
  name: 'Rust',
  grammars: ['source.rust'],
  diagnostics: {
    version: '0.2.0',
    analyticsEventName: 'rust.observe-diagnostics',
  },
  definition: {
    version: '0.1.0',
    priority: 1,
    definitionEventName: 'rust.definition',
  },
  codeAction: {
    version: '0.1.0',
    priority: 1,
    analyticsEventName: 'rust.codeAction',
    applyAnalyticsEventName: 'rust.applyCodeAction',
  },
  codeFormat: {
    version: '0.1.0',
    priority: 1,
    analyticsEventName: 'rust.codeFormat',
    canFormatRanges: true,
    canFormatAtPosition: true,
  },
  findReferences: {
    version: '0.1.0',
    analyticsEventName: 'rust.findReferences',
  },
  rename: {
    version: '0.0.0',
    priority: 1,
    analyticsEventName: 'rust.rename',
  },
  autocomplete: {
    inclusionPriority: 1,
    suggestionPriority: 3,
    excludeLowerPriority: false,
    analytics: {
      eventName: 'nuclide-rust',
      shouldLogInsertedSuggestion: false,
    },
    disableForSelector: '.source.rust .comment, .source.rust .string',
    autocompleteCacherConfig: null,
    supportsResolve: false,
  },
  typeHint: {
    version: '0.0.0',
    priority: 1,
    analyticsEventName: 'rust.typeHint',
  },
};

export function createRustLanguageService(): AtomLanguageService<
  LanguageService,
> {
  return new AtomLanguageService(connectionToRustService, atomConfig);
}
