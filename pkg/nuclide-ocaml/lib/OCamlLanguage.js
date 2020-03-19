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

import featureConfig from 'nuclide-commons-atom/feature-config';
import {
  AtomLanguageService,
  getHostServices,
} from '../../nuclide-language-service';
import {NullLanguageService} from '../../nuclide-language-service-rpc';
import {parseLogLevel} from '../../nuclide-logging/lib/rpc-types';
import {getNotifierByConnection} from '../../nuclide-open-files';
import {getVSCodeLanguageServiceByConnection} from '../../nuclide-remote-connection';

async function createOCamlLanguageService(
  connection: ?ServerConnection,
): Promise<LanguageService> {
  const service = getVSCodeLanguageServiceByConnection(connection);
  const [fileNotifier, host] = await Promise.all([
    getNotifierByConnection(connection),
    getHostServices(),
  ]);

  const logLevel = parseLogLevel(
    featureConfig.get('nuclide-ocaml.logLevel'),
    'DEBUG',
  );

  let ocpindent = featureConfig.get('nuclide-ocaml.pathToOcpIndent');
  if (typeof ocpindent !== 'string' || ocpindent === '') {
    ocpindent = null;
  }

  const lspService = await service.createMultiLspLanguageService(
    'ocaml',
    'ocaml-language-server',
    ['--stdio'],
    {
      logCategory: 'OcamlService',
      logLevel,
      fileNotifier,
      host,
      projectFileNames: [], // not needed for ocaml search strategy
      projectFileSearchStrategy: 'ocaml',
      useOriginalEnvironment: true,
      fileExtensions: ['.ml', '.mli', '.re', '.rei'],
      additionalLogFilesRetentionPeriod: 15 * 60 * 1000, // 15 minutes
      waitForDiagnostics: true,
      waitForStatus: true,

      // ocaml-language-server will use defaults for any settings that aren't
      // given, so we only need to list non-defaults here.
      initializationOptions: {
        codelens: {
          // This doesn't actually change the encoding (Nuclide/Atom can handle
          // unicode just fine), but instead just disables some single-character
          // substitutions that make displayed code lenses not valid OCaml.
          unicode: false,
        },
        format: {
          width: 80,
        },
        path:
          ocpindent == null
            ? undefined
            : {
                ocpindent,
              },
      },
    },
  );
  return lspService || new NullLanguageService();
}

export function createLanguageService(): AtomLanguageService<LanguageService> {
  let aboutUrl = 'https://github.com/ocaml/merlin/wiki';
  try {
    // $FlowFB
    const strings = require('./fb-ocaml-strings');
    aboutUrl = strings.aboutUrl;
  } catch (_) {}

  const atomConfig: AtomLanguageServiceConfig = {
    name: 'OCaml',
    grammars: ['source.ocaml', 'source.reason'],
    outline: {
      version: '0.1.0',
      priority: 1,
      analyticsEventName: 'ocaml.outline',
    },
    definition: {
      version: '0.1.0',
      priority: 20,
      definitionEventName: 'ocaml.getDefinition',
    },
    typeHint: {
      version: '0.0.0',
      priority: 1,
      analyticsEventName: 'ocaml.typeHint',
    },
    codeFormat: {
      version: '0.1.0',
      priority: 1,
      analyticsEventName: 'ocaml.formatCode',
      canFormatRanges: true,
      canFormatAtPosition: false,
    },
    findReferences: {
      version: '0.1.0',
      analyticsEventName: 'ocaml.findReferences',
    },
    rename: {
      version: '0.0.0',
      priority: 1,
      analyticsEventName: 'ocaml.rename',
    },
    autocomplete: {
      inclusionPriority: 1,
      // OCaml completions are more relevant than snippets.
      suggestionPriority: 3,
      disableForSelector: null,
      excludeLowerPriority: false,
      analytics: {
        eventName: 'nuclide-ocaml',
        shouldLogInsertedSuggestion: false,
      },
      autocompleteCacherConfig: null,
      supportsResolve: true,
    },
    diagnostics: {
      version: '0.2.0',
      analyticsEventName: 'ocaml.observeDiagnostics',
    },
    status: {
      version: '0.1.0',
      priority: 99,
      observeEventName: 'ocaml.status.observe',
      clickEventName: 'ocaml.status.click',
      iconMarkdown:
        '<div class="icon ocaml-icon" style="margin-left:5px;display:inline"/>',
      description: `__Merlin__ provides errors, autocomplete, hyperclick, and outline from OCaml/reason. [Read more...](${aboutUrl})`,
    },
  };

  return new AtomLanguageService(createOCamlLanguageService, atomConfig);
}
