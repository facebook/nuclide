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
import typeof * as GraphQLService from '../../nuclide-graphql-rpc/lib/GraphQLService';

import {
  AtomLanguageService,
  getHostServices,
} from '../../nuclide-language-service';
import {getNotifierByConnection} from '../../nuclide-open-files';
import {getServiceByConnection} from '../../nuclide-remote-connection';

const GRAPHQL_SERVICE_NAME = 'GraphQLService';

async function connectionToGraphQLService(
  connection: ?ServerConnection,
): Promise<LanguageService> {
  const graphqlService: GraphQLService = getServiceByConnection(
    GRAPHQL_SERVICE_NAME,
    connection,
  );
  const [fileNotifier, host] = await Promise.all([
    getNotifierByConnection(connection),
    getHostServices(),
  ]);
  const graphqlCommand = 'graphql-language-service/bin/graphql.js';
  const options = {
    env: {...process.env, ELECTRON_RUN_AS_NODE: '1'},
  };

  return graphqlService.initializeLsp(
    graphqlCommand,
    ['server', '--method', 'stream'],
    options,
    ['.graphqlconfig'],
    ['.js', '.graphql'],
    'INFO',
    fileNotifier,
    host,
  );
}

async function createLanguageService(): Promise<
  AtomLanguageService<LanguageService>,
> {
  const diagnosticsConfig = {
    version: '0.2.0',
    analyticsEventName: 'graphql.observe-diagnostics',
  };

  const definitionConfig = {
    version: '0.1.0',
    priority: 1,
    definitionEventName: 'graphql.definition',
  };

  const autocompleteConfig = {
    version: '2.0.0',
    inclusionPriority: 1,
    suggestionPriority: 3,
    excludeLowerPriority: false,
    analyticsEventName: 'graphql.getAutocompleteSuggestions',
    disableForSelector: null,
    autocompleteCacherConfig: null,
    onDidInsertSuggestionAnalyticsEventName: 'graphql.autocomplete-chosen',
  };

  const atomConfig: AtomLanguageServiceConfig = {
    name: 'GraphQL',
    grammars: ['source.graphql', 'source.js.jsx', 'source.js'],
    diagnostics: diagnosticsConfig,
    definition: definitionConfig,
    autocomplete: autocompleteConfig,
  };
  return new AtomLanguageService(connectionToGraphQLService, atomConfig);
}

export let graphqlLanguageService: Promise<
  AtomLanguageService<LanguageService>,
> = createLanguageService();

export function resetGraphQLLanguageService(): void {
  graphqlLanguageService.then(value => value.dispose());
  graphqlLanguageService = createLanguageService();
}
