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

import type {
  Viewable,
  WorkspaceViewsService,
} from '../../nuclide-workspace-views/lib/types';
import type {
  AppState,
  ConsolePersistedState,
  ConsoleService,
  SourceInfo,
  Message,
  OutputProvider,
  OutputProviderStatus,
  OutputService,
  Record,
  RegisterExecutorFunction,
  Store,
} from './types';
import type {CreatePasteFunction} from '../../nuclide-paste-base';
import createPackage from 'nuclide-commons-atom/createPackage';
import {
  viewableFromReactElement,
} from '../../commons-atom/viewableFromReactElement';
import {
  combineEpics,
  createEpicMiddleware,
} from '../../commons-node/redux-observable';
import featureConfig from 'nuclide-commons-atom/feature-config';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import Reducers from './redux/Reducers';
import {ConsoleContainer, WORKSPACE_VIEW_URI} from './ui/ConsoleContainer';
import invariant from 'assert';
import React from 'react';
import {applyMiddleware, createStore} from 'redux';

const MAXIMUM_SERIALIZED_MESSAGES_CONFIG =
  'nuclide-console.maximumSerializedMessages';

class Activation {
  _disposables: UniversalDisposable;
  _rawState: ?Object;
  _store: Store;
  _createPasteFunction: ?CreatePasteFunction;

  constructor(rawState: ?Object) {
    this._rawState = rawState;
    this._disposables = new UniversalDisposable(
      atom.contextMenu.add({
        '.nuclide-console-record': [
          {
            label: 'Copy Message',
            command: 'nuclide-console:copy-message',
          },
        ],
      }),
      atom.commands.add(
        '.nuclide-console-record',
        'nuclide-console:copy-message',
        event => {
          const el = event.target;
          if (el == null || typeof el.innerText !== 'string') {
            return;
          }
          atom.clipboard.write(el.innerText);
        },
      ),
      atom.commands.add('atom-workspace', 'nuclide-console:clear', () =>
        this._getStore().dispatch(Actions.clearRecords()),
      ),
      featureConfig.observe(
        'nuclide-console.maximumMessageCount',
        (maxMessageCount: any) => {
          this._getStore().dispatch(
            Actions.setMaxMessageCount(maxMessageCount),
          );
        },
      ),
    );
  }

  _getStore(): Store {
    if (this._store == null) {
      const initialState = deserializeAppState(this._rawState);
      const epics = Object.keys(Epics)
        .map(k => Epics[k])
        .filter(epic => typeof epic === 'function');
      const rootEpic = combineEpics(...epics);
      this._store = createStore(
        Reducers,
        initialState,
        applyMiddleware(createEpicMiddleware(rootEpic)),
      );
    }
    return this._store;
  }

  dispose() {
    this._disposables.dispose();
  }

  consumeToolBar(getToolBar: toolbar$GetToolbar): void {
    const toolBar = getToolBar('nuclide-console');
    toolBar.addButton({
      icon: 'terminal',
      callback: 'nuclide-console:toggle',
      tooltip: 'Toggle Console',
      priority: 700,
    });
    this._disposables.add(() => {
      toolBar.removeItems();
    });
  }

  consumePasteProvider(provider: any): void {
    this._createPasteFunction = (provider.createPaste: CreatePasteFunction);
  }

  consumeWorkspaceViewsService(api: WorkspaceViewsService): void {
    this._disposables.add(
      api.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return viewableFromReactElement(
            <ConsoleContainer
              store={this._getStore()}
              createPasteFunction={this._createPasteFunction}
            />,
          );
        }
      }),
      () => api.destroyWhere(item => item instanceof ConsoleContainer),
      atom.commands.add('atom-workspace', 'nuclide-console:toggle', event => {
        api.toggle(WORKSPACE_VIEW_URI, (event: any).detail);
      }),
    );
  }

  deserializeConsoleContainer(state: ConsolePersistedState): Viewable {
    return viewableFromReactElement(
      <ConsoleContainer
        store={this._getStore()}
        createPasteFunction={this._createPasteFunction}
        initialFilterText={state.filterText}
        initialEnableRegExpFilter={state.enableRegExpFilter}
        initialUnselectedSourceIds={state.unselectedSourceIds}
      />,
    );
  }

  /**
   * This service provides a factory for creating a console object tied to a particular source. If
   * the consumer wants to expose starting and stopping functionality through the Console UI (for
   * example, to allow the user to decide when to start and stop tailing logs), they can include
   * `start()` and `stop()` functions on the object they pass to the factory.
   *
   * When the factory is invoked, the source will be added to the Console UI's filter list. The
   * factory returns a Disposable which should be disposed of when the source goes away (e.g. its
   * package is disabled). This will remove the source from the Console UI's filter list (as long as
   * there aren't any remaining messages from the source).
   */
  provideConsole(): ConsoleService {
    // Create a local, nullable reference so that the service consumers don't keep the Activation
    // instance in memory.
    let activation = this;
    this._disposables.add(() => {
      activation = null;
    });

    return (sourceInfo: SourceInfo) => {
      invariant(activation != null);
      let disposed;
      activation._getStore().dispatch(Actions.registerSource(sourceInfo));
      const console = {
        // TODO: Update these to be (object: any, ...objects: Array<any>): void.
        log(object: string): void {
          console.append({text: object, level: 'log'});
        },
        warn(object: string): void {
          console.append({text: object, level: 'warning'});
        },
        error(object: string): void {
          console.append({text: object, level: 'error'});
        },
        info(object: string): void {
          console.append({text: object, level: 'info'});
        },
        append(message: Message): void {
          invariant(activation != null && !disposed);
          activation._getStore().dispatch(
            Actions.recordReceived({
              text: message.text,
              level: message.level,
              data: message.data,
              tags: message.tags,
              scopeName: message.scopeName,
              sourceId: sourceInfo.id,
              kind: message.kind || 'message',
              timestamp: new Date(), // TODO: Allow this to come with the message?
            }),
          );
        },
        setStatus(status: OutputProviderStatus): void {
          invariant(activation != null && !disposed);
          activation
            ._getStore()
            .dispatch(Actions.updateStatus(sourceInfo.id, status));
        },
        dispose(): void {
          invariant(activation != null);
          if (!disposed) {
            disposed = true;
            activation
              ._getStore()
              .dispatch(Actions.removeSource(sourceInfo.id));
          }
        },
      };
      return console;
    };
  }

  provideOutputService(): OutputService {
    // Create a local, nullable reference so that the service consumers don't keep the Activation
    // instance in memory.
    let activation = this;
    this._disposables.add(() => {
      activation = null;
    });

    return {
      registerOutputProvider(outputProvider: OutputProvider): IDisposable {
        invariant(activation != null, 'Output service used after deactivation');
        activation
          ._getStore()
          .dispatch(Actions.registerOutputProvider(outputProvider));
        return new UniversalDisposable(() => {
          if (activation != null) {
            activation
              ._getStore()
              .dispatch(Actions.unregisterOutputProvider(outputProvider));
          }
        });
      },
    };
  }

  provideRegisterExecutor(): RegisterExecutorFunction {
    // Create a local, nullable reference so that the service consumers don't keep the Activation
    // instance in memory.
    let activation = this;
    this._disposables.add(() => {
      activation = null;
    });

    return executor => {
      invariant(
        activation != null,
        'Executor registration attempted after deactivation',
      );
      activation._getStore().dispatch(Actions.registerExecutor(executor));
      return new UniversalDisposable(() => {
        if (activation != null) {
          activation._getStore().dispatch(Actions.unregisterExecutor(executor));
        }
      });
    };
  }

  serialize(): Object {
    if (this._store == null) {
      return {};
    }
    const maximumSerializedMessages: number = (featureConfig.get(
      MAXIMUM_SERIALIZED_MESSAGES_CONFIG,
    ): any);
    return {
      records: this._store.getState().records.slice(-maximumSerializedMessages),
    };
  }
}

function deserializeAppState(rawState: ?Object): AppState {
  return {
    executors: new Map(),
    currentExecutorId: null,
    records: rawState && rawState.records
      ? rawState.records.map(deserializeRecord)
      : [],
    history: [],
    providers: new Map(),
    providerStatuses: new Map(),

    // This value will be replaced with the value form the config. We just use `POSITIVE_INFINITY`
    // here to conform to the AppState type defintion.
    maxMessageCount: Number.POSITIVE_INFINITY,
  };
}

function deserializeRecord(record: Object): Record {
  return {
    ...record,
    timestamp: parseDate(record.timestamp) || new Date(0),
  };
}

function parseDate(raw: ?string): ?Date {
  if (raw == null) {
    return null;
  }
  const date = new Date(raw);
  return isNaN(date.getTime()) ? null : date;
}

createPackage(module.exports, Activation);
