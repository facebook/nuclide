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

import {bufferPositionForMouseEvent} from 'nuclide-commons-atom/mouse-to-position';
import typeof * as FlowService from '../../nuclide-flow-rpc';
import type {
  FlowLanguageServiceType,
  ServerStatusType,
  ServerStatusUpdate,
  FlowSettings,
} from '../../nuclide-flow-rpc';
import type {LanguageService} from '../../nuclide-language-service/lib/LanguageService';
import type {ServerConnection} from '../../nuclide-remote-connection';
import type {AtomLanguageServiceConfig} from '../../nuclide-language-service/lib/AtomLanguageService';
import type {BusySignalService} from 'atom-ide-ui';
import type {FindReferencesViewService} from 'atom-ide-ui/pkg/atom-ide-find-references/lib/types';

import invariant from 'assert';
import {Observable} from 'rxjs';

import createPackage from 'nuclide-commons-atom/createPackage';
import featureConfig from 'nuclide-commons-atom/feature-config';
import registerGrammar from '../../commons-atom/register-grammar';
import passesGK from '../../commons-node/passesGK';
import {onceGkInitialized, isGkEnabled} from '../../commons-node/passesGK';
import {NullLanguageService} from '../../nuclide-language-service-rpc';
import {
  getNotifierByConnection,
  getFileVersionOfEditor,
} from '../../nuclide-open-files';
import {
  AtomLanguageService,
  getHostServices,
  updateAutocompleteResults,
  updateAutocompleteFirstResults,
} from '../../nuclide-language-service';
import {getLogger} from 'log4js';
import {filterResultsByPrefix, shouldFilter} from '../../nuclide-flow-common';
import {
  ConnectionCache,
  getServiceByConnection,
  getVSCodeLanguageServiceByConnection,
} from '../../nuclide-remote-connection';
import {completingSwitchMap} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nuclideUri from 'nuclide-commons/nuclideUri';

import {FlowServiceWatcher} from './FlowServiceWatcher';

import {JS_GRAMMARS} from './constants';

class Activation {
  _disposed: boolean;
  _activationPromise: ?Promise<UniversalDisposable>;

  constructor() {
    onceGkInitialized(this._onGKInitialized.bind(this));
  }

  _onGKInitialized(): void {
    if (this._disposed) {
      return;
    }
    this._activationPromise = isGkEnabled('nuclide_flow_lsp')
      ? activateLsp()
      : activateLegacy();
  }

  dispose(): void {
    this._disposed = true;
    if (this._activationPromise != null) {
      this._activationPromise.then(activation => activation.dispose());
    }
    this._activationPromise = null;
  }
}

createPackage(module.exports, Activation);

/* ---------------------------------------------------------
 * LSP Flow IDE connection
 * ---------------------------------------------------------
 */

async function activateLsp(): Promise<UniversalDisposable> {
  const atomConfig: AtomLanguageServiceConfig = {
    name: 'Flow',
    grammars: JS_GRAMMARS,
    typeHint: {
      version: '0.0.0',
      priority: 1,
      analyticsEventName: 'nuclide-flow.typeHint',
    },
    diagnostics: {
      version: '0.2.0',
      analyticsEventName: 'flow.receive-push-diagnostics',
    },
    definition: {
      version: '0.1.0',
      priority: 20,
      definitionEventName: 'flow.get-definition',
    },
    autocomplete: {
      inclusionPriority: 1,
      suggestionPriority: 3,
      disableForSelector: null,
      excludeLowerPriority: false,
      analytics: {
        eventName: 'nuclide-flow',
        shouldLogInsertedSuggestion: false,
      },
      autocompleteCacherConfig: {
        updateResults: updateAutocompleteResults,
        updateFirstResults: updateAutocompleteFirstResults,
      },
      supportsResolve: false,
    },
  };

  const languageServiceFactory: (
    ?ServerConnection,
  ) => Promise<LanguageService> = async connection => {
    const [fileNotifier, host] = await Promise.all([
      getNotifierByConnection(connection),
      getHostServices(),
    ]);
    const service = getVSCodeLanguageServiceByConnection(connection);
    const pathToFlow = ((featureConfig.get(
      'nuclide-flow.pathToFlow',
    ): any): string);
    const lspService = await service.createMultiLspLanguageService(
      'flow',
      pathToFlow,
      ['lsp', '--from', 'nuclide'],
      {
        fileNotifier,
        host,
        projectFileNames: ['.flowconfig'],
        fileExtensions: ['.js', '.jsx'],
        logCategory: 'flow-language-server',
        logLevel: 'ALL',
        additionalLogFilesRetentionPeriod: 5 * 60 * 1000, // 5 minutes
      },
    );
    // TODO(ljw):
    // stopFlowOnExit: Boolean(featureConfig.get('nuclide-flow.stopFlowOnExit')),
    // '--lazy-mode ide': Boolean(featureConfig.get('nuclide-flow.lazyServer'))
    //   and passesGK('nuclide_flow_lazy_mode_ide')
    // canUseFlowBin: canUseFlowBin: Boolean(featureConfig.get('nuclide-flow.canUseFlowBin')),
    return lspService || new NullLanguageService();
  };

  const atomLanguageService = new AtomLanguageService(
    languageServiceFactory,
    atomConfig,
    null,
    getLogger('nuclide-flow'),
  );
  atomLanguageService.activate();

  return new UniversalDisposable(atomLanguageService);
}

/* ---------------------------------------------------------
 * Legacy Flow language services
 * ---------------------------------------------------------
 */

let connectionCache: ?ConnectionCache<FlowLanguageServiceType> = null;

function getConnectionCache(): ConnectionCache<FlowLanguageServiceType> {
  invariant(connectionCache != null);
  return connectionCache;
}

async function activateLegacy(): Promise<UniversalDisposable> {
  connectionCache = new ConnectionCache(connectionToFlowService);

  const disposables = new UniversalDisposable(
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
    atom.packages.serviceHub.consume(
      'atom-ide-busy-signal',
      '0.1.0',
      // When the package becomes available to us, it invokes this callback:
      (service: BusySignalService) => {
        const disposableForBusyService = consumeBusySignal(service);
        // When the package becomes no longer available to us, it disposes this object:
        return disposableForBusyService;
      },
    ),
    atom.packages.serviceHub.consume(
      'find-references-view',
      '0.1.0',
      consumeFindReferencesView,
    ),
  );

  registerGrammar('source.ini', ['.flowconfig']);

  return disposables;
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
  getLogger('nuclide-flow').info(
    'Checking the nuclide_flow_lazy_mode_ide gk...',
  );
  const ideLazyMode = await passesGK(
    'nuclide_flow_lazy_mode_ide',
    15 * 1000, // 15 second timeout
  );
  getLogger('nuclide-flow').info('ideLazyMode: %s', ideLazyMode);
  const config: FlowSettings = {
    functionSnippetShouldIncludeArguments: Boolean(
      featureConfig.get('nuclide-flow.functionSnippetShouldIncludeArguments'),
    ),
    stopFlowOnExit: Boolean(featureConfig.get('nuclide-flow.stopFlowOnExit')),
    lazyServer: Boolean(featureConfig.get('nuclide-flow.lazyServer')),
    ideLazyMode,
    canUseFlowBin: Boolean(featureConfig.get('nuclide-flow.canUseFlowBin')),
    pathToFlow: ((featureConfig.get('nuclide-flow.pathToFlow'): any): string),
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
      return messagesForRoot.let(
        completingSwitchMap(nextStatus => {
          // I would use constants here but the constant is in the flow-rpc package which we can't
          // load directly from this package. Casting to the appropriate type is just as safe.
          if (
            nextStatus.status === ('init': ServerStatusType) ||
            nextStatus.status === ('busy': ServerStatusType)
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
        }),
      );
    })
    .subscribe();
}

let busySignalService: ?BusySignalService = null;

function consumeBusySignal(service: BusySignalService): IDisposable {
  busySignalService = service;
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
    busySignalService = null;
    subscription.unsubscribe();
  });
}

function consumeFindReferencesView(
  service: FindReferencesViewService,
): IDisposable {
  const promise: Promise<IDisposable> = registerMultiHopFindReferencesCommand(
    service,
  );
  return new UniversalDisposable(() => {
    promise.then(disposable => disposable.dispose());
  });
}

async function registerMultiHopFindReferencesCommand(
  service: FindReferencesViewService,
): Promise<IDisposable> {
  if (!(await shouldEnableFindRefs())) {
    return new UniversalDisposable();
  }
  let lastMouseEvent = null;
  atom.contextMenu.add({
    'atom-text-editor[data-grammar="source js jsx"]': [
      {
        label: 'Find Indirect References (slower)',
        command: 'nuclide-flow:find-indirect-references',
        created: event => {
          lastMouseEvent = event;
        },
      },
    ],
  });
  return atom.commands.add(
    'atom-text-editor',
    'nuclide-flow:find-indirect-references',
    async () => {
      const editor = atom.workspace.getActiveTextEditor();
      if (editor == null) {
        return;
      }
      const path = editor.getPath();
      if (path == null) {
        return;
      }
      const cursors = editor.getCursors();
      if (cursors.length !== 1) {
        return;
      }
      const cursor = cursors[0];
      const position =
        lastMouseEvent != null
          ? bufferPositionForMouseEvent(lastMouseEvent, editor)
          : cursor.getBufferPosition();
      lastMouseEvent = null;
      const fileVersion = await getFileVersionOfEditor(editor);
      const flowLS = await getConnectionCache().getForUri(path);
      if (flowLS == null) {
        return;
      }
      if (fileVersion == null) {
        return;
      }
      const getReferences = () =>
        flowLS
          .customFindReferences(fileVersion, position, true, true)
          .refCount()
          .toPromise();
      let result;
      if (busySignalService == null) {
        result = await getReferences();
      } else {
        result = await busySignalService.reportBusyWhile(
          'Running Flow find-indirect-references (this may take a while)',
          getReferences,
          {
            revealTooltip: true,
            waitingFor: 'computer',
          },
        );
      }
      if (result == null) {
        atom.notifications.addInfo('No find references results available');
      } else if (result.type === 'data') {
        service.viewResults(result);
      } else {
        atom.notifications.addWarning(
          `Flow find-indirect-references issued an error: "${result.message}"`,
        );
      }
    },
  );
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
  const enableFindRefs = await shouldEnableFindRefs();
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
      // Disabled as it's responsible for many calls/spawns that:
      // In aggregate degrades the performance siginificantly.
      updateOnEdit: false,
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
      disableForSelector: '.source.js .comment',
      excludeLowerPriority,
      // We want to get ranked higher than the snippets provider by default,
      // but it's configurable
      suggestionPriority: flowResultsFirst ? 5 : 1,
      inclusionPriority: 1,
      analytics: {
        eventName: 'nuclide-flow',
        shouldLogInsertedSuggestion: false,
      },
      autocompleteCacherConfig: {
        // TODO: update the ranges once Flow LSP starts returning TextEdits.
        updateResults: (_originalRequest, request, results) =>
          filterResultsByPrefix(request.prefix, results),
        shouldFilter,
      },
      supportsResolve: false,
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
    findReferences: enableFindRefs
      ? {
          version: '0.1.0',
          analyticsEventName: 'flow.find-references',
        }
      : undefined,
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

async function shouldEnableFindRefs(): Promise<boolean> {
  return (
    Boolean(featureConfig.get('nuclide-flow.enableFindReferences')) ||
    passesGK(
      'nuclide_flow_find_refs',
      // Wait 15 seconds for the gk check
      15 * 1000,
    )
  );
}
