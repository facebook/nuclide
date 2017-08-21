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

import typeof * as FlowService from '../../nuclide-flow-rpc';
import type {
  FlowLanguageServiceType,
  ServerStatusType,
  ServerStatusUpdate,
  FlowSettings,
} from '../../nuclide-flow-rpc';
import type {ServerConnection} from '../../nuclide-remote-connection';
import type {AtomLanguageServiceConfig} from '../../nuclide-language-service/lib/AtomLanguageService';
import type {BusySignalService} from 'atom-ide-ui';

import invariant from 'assert';
import {Observable} from 'rxjs';

import featureConfig from 'nuclide-commons-atom/feature-config';
import registerGrammar from '../../commons-atom/register-grammar';
import passesGK from '../../commons-node/passesGK';
import {getNotifierByConnection} from '../../nuclide-open-files';
import {
  AtomLanguageService,
  getHostServices,
} from '../../nuclide-language-service';
import {getLogger} from 'log4js';
import {filterResultsByPrefix, shouldFilter} from '../../nuclide-flow-common';
import {
  ConnectionCache,
  getServiceByConnection,
} from '../../nuclide-remote-connection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nuclideUri from 'nuclide-commons/nuclideUri';

import {FlowServiceWatcher} from './FlowServiceWatcher';

import {JS_GRAMMARS} from './constants';

let disposables;
let connectionCache: ?ConnectionCache<FlowLanguageServiceType> = null;

function getConnectionCache(): ConnectionCache<FlowLanguageServiceType> {
  invariant(connectionCache != null);
  return connectionCache;
}

export async function activate() {
  if (!disposables) {
    connectionCache = new ConnectionCache(connectionToFlowService);

    disposables = new UniversalDisposable(
      connectionCache,
      () => {
        connectionCache = null;
      },
      new FlowServiceWatcher(connectionCache),
      atom.commands.add(
        'atom-workspace',
        'nuclide-flow:restart-flow-server',
        allowFlowServerRestart,
      ),
      Observable.fromPromise(getLanguageServiceConfig()).subscribe(lsConfig => {
        const flowLanguageService = new AtomLanguageService(
          connection => getConnectionCache().get(connection),
          lsConfig,
        );
        flowLanguageService.activate();
        // `disposables` is always disposed before it is set to null. If it has been disposed,
        // this subscription will have been disposed as well and we will not enter this callback.
        invariant(disposables != null);
        disposables.add(flowLanguageService);
      }),
    );

    registerGrammar('source.ini', ['.flowconfig']);
  }
}

async function connectionToFlowService(
  connection: ?ServerConnection,
): Promise<FlowLanguageServiceType> {
  const flowService: FlowService = getServiceByConnection(
    'FlowService',
    connection,
  );
  const fileNotifier = await getNotifierByConnection(connection);
  const host = await getHostServices();
  const config: FlowSettings = {
    functionSnippetShouldIncludeArguments: Boolean(
      featureConfig.get('nuclide-flow.functionSnippetShouldIncludeArguments'),
    ),
    stopFlowOnExit: Boolean(featureConfig.get('nuclide-flow.stopFlowOnExit')),
    lazyServer: Boolean(featureConfig.get('nuclide-flow.lazyServer')),
  };
  const languageService = await flowService.initialize(
    fileNotifier,
    host,
    config,
  );

  return languageService;
}

// Exported only for testing
export function serverStatusUpdatesToBusyMessages(
  statusUpdates: Observable<ServerStatusUpdate>,
  busySignal: BusySignalService,
): rxjs$Subscription {
  return statusUpdates
    .groupBy(({pathToRoot}) => pathToRoot)
    .mergeMap(messagesForRoot => {
      return (
        messagesForRoot
          // Append a null sentinel to ensure that completion clears the busy signal.
          .concat(Observable.of(null))
          .switchMap(nextStatus => {
            // I would use constants here but the constant is in the flow-rpc package which we can't
            // load directly from this package. Casting to the appropriate type is just as safe.
            if (
              nextStatus != null &&
              (nextStatus.status === ('init': ServerStatusType) ||
                nextStatus.status === ('busy': ServerStatusType))
            ) {
              const readablePath = nuclideUri.nuclideUriToDisplayString(
                nextStatus.pathToRoot,
              );
              const readableStatus =
                nextStatus.status === ('init': ServerStatusType)
                  ? 'initializing'
                  : 'busy';
              // Use an observable to encapsulate clearing the message.
              // The switchMap above will ensure that messages get cleared.
              return Observable.create(observer => {
                const disposable = busySignal.reportBusy(
                  `Flow server is ${readableStatus} (${readablePath})`,
                );
                return () => disposable.dispose();
              });
            }
            return Observable.empty();
          })
      );
    })
    .subscribe();
}

export function consumeBusySignal(service: BusySignalService): IDisposable {
  const serverStatusUpdates = getConnectionCache()
    .observeValues()
    // mergeAll loses type info
    .mergeMap(x => x)
    .mergeMap(ls => {
      return ls.getServerStatusUpdates().refCount();
    });

  const subscription = serverStatusUpdatesToBusyMessages(
    serverStatusUpdates,
    service,
  );
  return new UniversalDisposable(() => {
    subscription.unsubscribe();
  });
}

export function deactivate() {
  if (disposables != null) {
    disposables.dispose();
    disposables = null;
  }
}

async function allowFlowServerRestart(): Promise<void> {
  const services = await Promise.all(getConnectionCache().values());
  for (const service of services) {
    service.allowServerRestart();
  }
}

async function getLanguageServiceConfig(): Promise<AtomLanguageServiceConfig> {
  const enableHighlight = featureConfig.get(
    'nuclide-flow.enableReferencesHighlight',
  );
  const excludeLowerPriority = Boolean(
    featureConfig.get('nuclide-flow.excludeOtherAutocomplete'),
  );
  const flowResultsFirst = Boolean(
    featureConfig.get('nuclide-flow.flowAutocompleteResultsFirst'),
  );
  const enableTypeHints = Boolean(
    featureConfig.get('nuclide-flow.enableTypeHints'),
  );
  return {
    name: 'Flow',
    grammars: JS_GRAMMARS,
    // flowlint-next-line sketchy-null-mixed:off
    highlight: enableHighlight
      ? {
          version: '0.1.0',
          priority: 1,
          analyticsEventName: 'flow.codehighlight',
        }
      : undefined,
    outline: {
      version: '0.1.0',
      priority: 1,
      analyticsEventName: 'flow.outline',
    },
    coverage: {
      version: '0.0.0',
      priority: 10,
      analyticsEventName: 'flow.coverage',
      icon: 'nuclicon-flow',
    },
    definition: {
      version: '0.1.0',
      priority: 20,
      definitionEventName: 'flow.get-definition',
    },
    autocomplete: {
      version: '2.0.0',
      disableForSelector: '.source.js .comment',
      excludeLowerPriority,
      // We want to get ranked higher than the snippets provider by default,
      // but it's configurable
      suggestionPriority: flowResultsFirst ? 5 : 1,
      inclusionPriority: 1,
      analyticsEventName: 'flow.autocomplete',
      autocompleteCacherConfig: {
        updateResults: (request, results) =>
          filterResultsByPrefix(request.prefix, results),
        shouldFilter,
      },
      onDidInsertSuggestionAnalyticsEventName:
        'nuclide-flow.autocomplete-chosen',
    },
    diagnostics: (await shouldUsePushDiagnostics())
      ? {
          version: '0.2.0',
          analyticsEventName: 'flow.receive-push-diagnostics',
        }
      : {
          version: '0.1.0',
          shouldRunOnTheFly: false,
          analyticsEventName: 'flow.run-diagnostics',
        },
    typeHint: enableTypeHints
      ? {
          version: '0.0.0',
          priority: 1,
          analyticsEventName: 'nuclide-flow.typeHint',
        }
      : undefined,
    evaluationExpression: {
      version: '0.0.0',
      analyticsEventName: 'flow.evaluationExpression',
      matcher: {kind: 'default'},
    },
  };
}

async function shouldUsePushDiagnostics(): Promise<boolean> {
  const settingEnabled = Boolean(
    featureConfig.get('nuclide-flow.enablePushDiagnostics'),
  );

  getLogger('nuclide-flow').info(
    'Checking the Flow persistent connection gk...',
  );

  // Wait 15 seconds for the gk check
  const doesPassGK = await passesGK(
    'nuclide_flow_persistent_connection',
    15 * 1000,
  );
  getLogger('nuclide-flow').info(
    `Got Flow persistent connection gk: ${String(doesPassGK)}`,
  );
  const result = settingEnabled || doesPassGK;
  getLogger('nuclide-flow').info(
    `Enabling Flow persistent connection: ${String(result)}`,
  );
  return result;
}
