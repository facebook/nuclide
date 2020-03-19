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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import passesGK from 'nuclide-commons/passesGK';
import typeof * as HackService from '../../nuclide-hack-rpc/lib/HackService';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';
import type {ServerConnection} from '../../nuclide-remote-connection';
import type {AtomLanguageServiceConfig} from '../../nuclide-language-service/lib/AtomLanguageService';

import {NullLanguageService} from '../../nuclide-language-service-rpc';
import {getServiceByConnection} from '../../nuclide-remote-connection';
import {
  HACK_CONFIG_FILE_NAME,
  HACK_FILE_EXTENSIONS,
} from '../../nuclide-hack-common/lib/constants';
import {getConfig, logger} from './config';
import {getNotifierByConnection} from '../../nuclide-open-files';
import {
  AtomLanguageService,
  getHostServices,
  updateAutocompleteResults,
  updateAutocompleteFirstResults,
} from '../../nuclide-language-service';
import {HACK_GRAMMARS} from '../../nuclide-hack-common';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';

const HACK_SERVICE_NAME = 'HackService';

async function connectionToHackService(
  connection: ?ServerConnection,
): Promise<LanguageService> {
  const hackService: HackService = getServiceByConnection(
    HACK_SERVICE_NAME,
    connection,
  );
  const config = getConfig();
  const fileNotifier = await getNotifierByConnection(connection);

  const host = await getHostServices();
  const lspService = await hackService.initializeLsp(
    config.hhClientPath, // command
    ['lsp', '--from', 'nuclide', '--enhanced-hover'], // arguments
    [HACK_CONFIG_FILE_NAME], // project file
    HACK_FILE_EXTENSIONS, // which file-notifications should be sent to LSP
    config.logLevel,
    fileNotifier,
    host,
    {
      useTextEditAutocomplete: true,
    },
  );
  return lspService || new NullLanguageService();
}

async function createLanguageService(): Promise<
  AtomLanguageService<LanguageService>,
> {
  const isStatusEnabled = await passesGK('nuclide_hack_status');
  const atomConfig: AtomLanguageServiceConfig = {
    name: 'Hack',
    grammars: HACK_GRAMMARS,
    highlight: {
      version: '0.1.0',
      priority: 1,
      analyticsEventName: 'hack.codehighlight',
    },
    outline: {
      version: '0.1.0',
      priority: 1,
      analyticsEventName: 'hack.outline',
    },
    coverage: {
      version: '0.0.0',
      priority: 10,
      analyticsEventName: 'hack:run-type-coverage',
      icon: 'nuclicon-hack',
    },
    definition: {
      version: '0.1.0',
      priority: 20,
      definitionEventName: 'hack.get-definition',
    },
    typeHint: {
      version: '0.0.0',
      priority: 1,
      analyticsEventName: 'hack.typeHint',
    },
    codeFormat: {
      version: '0.1.0',
      priority: 1,
      analyticsEventName: 'hack.formatCode',
      canFormatRanges: true,
      canFormatAtPosition: true,
    },
    findReferences: {
      version: '0.1.0',
      analyticsEventName: 'hack:findReferences',
    },
    rename: {
      version: '0.0.0',
      priority: 1,
      analyticsEventName: 'hack:rename',
    },
    autocomplete: {
      inclusionPriority: 1,
      // The context-sensitive hack autocompletions are more relevant than snippets.
      suggestionPriority: 3,
      disableForSelector: null,
      excludeLowerPriority: false,
      analytics: {
        eventName: 'nuclide-hack',
        shouldLogInsertedSuggestion: true,
      },
      autocompleteCacherConfig: {
        updateResults: updateAutocompleteResults,
        updateFirstResults: updateAutocompleteFirstResults,
      },
      supportsResolve: true,
    },
    diagnostics: {
      version: '0.2.0',
      analyticsEventName: 'hack.observe-diagnostics',
    },
    status: isStatusEnabled
      ? {
          version: '0.1.0',
          priority: 1,
          observeEventName: 'hack.status.observe',
          clickEventName: 'hack.status.click',
          icon: 'nuclicon-hack',
          description:
            '__hh_server__ provides provides autocomplete, hyperclick, hover, errors and outline.',
        }
      : undefined,
  };

  return new AtomLanguageService(
    connectionToHackService,
    atomConfig,
    null,
    logger,
  );
}

// This needs to be initialized eagerly for Hack Symbol search and the HHVM Toolbar.
export let hackLanguageService: Promise<
  AtomLanguageService<LanguageService>,
> = createLanguageService();

export function resetHackLanguageService(): void {
  hackLanguageService.then(value => value.dispose());
  // Reset to an unactivated LanguageService when the Hack package is deactivated.
  // TODO: Sort out the dependencies between the HHVM toolbar, quick-open and Hack.
  hackLanguageService = createLanguageService();
}

export async function getHackLanguageForUri(
  uri: ?NuclideUri,
): Promise<?LanguageService> {
  return (await hackLanguageService).getLanguageServiceForUri(uri);
}

export async function isFileInHackProject(
  fileUri: NuclideUri,
): Promise<boolean> {
  const fileSystemService = getFileSystemServiceByNuclideUri(fileUri);
  const foundDir = await fileSystemService.findNearestAncestorNamed(
    '.hhconfig',
    fileUri,
  );
  return foundDir != null;
}
