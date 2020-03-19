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

import type {Message} from 'nuclide-commons/process';
import type {
  AppState,
  BoundActionCreators,
  TaskRunnerServiceApi,
  SerializedAppState,
  Store,
  TaskRunner,
  ToolbarStatePreference,
} from './types';
import type CwdApi from '../../nuclide-current-working-directory/lib/CwdApi';
import type {DistractionFreeModeProvider} from '../../nuclide-distraction-free-mode';
import type {ConsoleService} from 'atom-ide-ui';

import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import {renderReactRoot} from 'nuclide-commons-ui/renderReactRoot';
import {combineEpicsFromImports} from 'nuclide-commons/epicHelpers';
import syncAtomCommands from '../../commons-atom/sync-atom-commands';
import {track} from 'nuclide-analytics';
import createPackage from 'nuclide-commons-atom/createPackage';
import {LocalStorageJsonTable} from '../../commons-atom/LocalStorageJsonTable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {memoize} from 'lodash';
import {arrayEqual} from 'nuclide-commons/collection';
import {createEpicMiddleware} from 'nuclide-commons/redux-observable';
import observableFromReduxStore from 'nuclide-commons/observableFromReduxStore';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as Actions from './redux/Actions';
import * as Epics from './redux/Epics';
import * as Reducers from './redux/Reducers';
import getToolbarProps from './ui/getToolbarProps';
import Toolbar from './ui/Toolbar';
import invariant from 'assert';
import {
  applyMiddleware,
  bindActionCreators,
  combineReducers,
  createStore,
} from 'redux';
import {Observable} from 'rxjs';
import * as React from 'react';

// TODO: use a more general versioning mechanism.
// Perhaps Atom should provide packages with some way of doing this.
const SERIALIZED_VERSION = 2;
// These match task types with shortcuts defined in nuclide-task-runner.json
const COMMON_TASK_TYPES = ['build', 'run', 'test', 'debug'];

function getVisible(event: Event): ?boolean {
  // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
  if (event.detail != null && typeof event.detail === 'object') {
    const {visible} = event.detail;
    return visible != null ? Boolean(visible) : null;
  }
  return null;
}

class Activation {
  _disposables: UniversalDisposable;
  _actionCreators: BoundActionCreators;
  _panel: atom$Panel;
  _store: Store;

  constructor(rawState: ?SerializedAppState): void {
    let serializedState = rawState;
    if (
      serializedState != null &&
      serializedState.version !== SERIALIZED_VERSION
    ) {
      serializedState = null;
    }

    // The serialized state that Atom gives us here is based on the open roots. However, users often
    // open an empty window and then add a root (especially with remote projects). We need to go
    // outside of Atom's normal serialization mechanism to account for this.
    const preferencesForWorkingRoots = new LocalStorageJsonTable(
      'nuclide:nuclide-task-runner:working-root-preferences',
    );

    const initialVisibility = getInitialVisibility(
      serializedState,
      preferencesForWorkingRoots,
    );

    track('nuclide-task-runner:initialized', {
      visible: initialVisibility,
    });

    const epicOptions = {preferencesForWorkingRoots};
    const rootEpic = (actions, store) =>
      combineEpicsFromImports(Epics, 'nuclide-task-runner')(
        actions,
        store,
        epicOptions,
      );
    this._store = createStore(
      combineReducers(Reducers),
      {visible: initialVisibility},
      applyMiddleware(createEpicMiddleware(rootEpic)),
    );
    const states: Observable<AppState> = observableFromReduxStore(this._store)
      .filter((state: AppState) => state.initialPackagesActivated)
      .distinctUntilChanged()
      .share();
    this._actionCreators = bindActionCreators(Actions, this._store.dispatch);
    this._panel = atom.workspace.addTopPanel({
      item: {
        getElement: memoize(() => {
          const props = getToolbarProps(this._store);
          const StatefulToolbar = bindObservableAsProps(props, Toolbar);
          return renderReactRoot(<StatefulToolbar />, 'TaskRunnerToolbarRoot');
        }),
      },
      visible: false,
    });

    this._disposables = new UniversalDisposable(
      preferencesForWorkingRoots,
      activateInitialPackagesObservable().subscribe(() => {
        this._store.dispatch(Actions.didActivateInitialPackages());
      }),
      () => {
        this._panel.destroy();
      },
      atom.commands.add('atom-workspace', {
        'nuclide-task-runner:toggle-toolbar-visibility': event => {
          this._actionCreators.requestToggleToolbarVisibility(
            getVisible(event),
          );
        },
      }),
      // Add a command for each enabled task in each enabled task runner
      syncAtomCommands(
        states
          .map(state => state.statesForTaskRunners)
          .distinctUntilChanged()
          .map(statesForTaskRunners => {
            const taskRunnersAndTasks = new Set();
            statesForTaskRunners.forEach((state, taskRunner) => {
              state.tasks.forEach(task => {
                if (task.disabled !== true) {
                  taskRunnersAndTasks.add([taskRunner, task]);
                }
              });
            });
            return taskRunnersAndTasks;
          }),
        ([taskRunner, taskMeta]) => ({
          'atom-workspace': {
            [`nuclide-task-runner:${taskRunner.name
              .toLowerCase()
              .replace(' ', '-')}-${taskMeta.type}`]: event => {
              const {detail} = (event: any);
              this._actionCreators.runTask(taskRunner, taskMeta, detail);
            },
          },
        }),
      ),
      // Add a command for each enabled common task with mapped keyboard shortcuts
      syncAtomCommands(
        states
          .map(state => {
            const {activeTaskRunner, readyTaskRunners, taskRunners} = state;
            if (
              taskRunners.count() > readyTaskRunners.count() ||
              !activeTaskRunner
            ) {
              return [];
            }
            const taskRunnerState = state.statesForTaskRunners.get(
              activeTaskRunner,
            );
            if (!taskRunnerState) {
              return [];
            }
            return taskRunnerState.tasks;
          })
          .distinctUntilChanged(arrayEqual)
          .map(
            tasks =>
              new Set(
                tasks.filter(
                  task =>
                    task.disabled !== true &&
                    COMMON_TASK_TYPES.includes(task.type),
                ),
              ),
          ),
        taskMeta => ({
          'atom-workspace': {
            [`nuclide-task-runner:${taskMeta.type}`]: () => {
              const taskRunner: ?TaskRunner = this._store.getState()
                .activeTaskRunner;
              if (taskRunner != null) {
                this._actionCreators.runTask(taskRunner, taskMeta);
              }
            },
          },
        }),
      ),
      // Add a toggle command for each enabled task runner
      syncAtomCommands(
        states
          .map(state => state.statesForTaskRunners)
          .distinctUntilChanged()
          .map(statesForTaskRunners => {
            const taskRunners = new Set();
            statesForTaskRunners.forEach((state, runner) => {
              if (state.enabled) {
                taskRunners.add(runner);
              }
            });
            return taskRunners;
          }),
        taskRunner => ({
          'atom-workspace': {
            [`nuclide-task-runner:toggle-${taskRunner.name.toLowerCase()}-toolbar`]: event => {
              this._actionCreators.requestToggleToolbarVisibility(
                getVisible(event),
                taskRunner,
              );
            },
          },
        }),
        taskRunner => taskRunner.id,
      ),
      states
        .map(state => state.visible)
        .distinctUntilChanged()
        .subscribe(visible => {
          if (visible) {
            this._panel.show();
          } else {
            this._panel.hide();
          }
        }),
      // Add a "stop" command when a task is running.
      states
        .map(state => state.runningTask != null)
        .distinctUntilChanged()
        .switchMap(
          taskIsRunning =>
            taskIsRunning
              ? Observable.create(
                  () =>
                    new UniversalDisposable(
                      atom.commands.add(
                        'atom-workspace',
                        // eslint-disable-next-line nuclide-internal/atom-apis
                        'nuclide-task-runner:stop-task',
                        () => {
                          this._actionCreators.stopTask();
                        },
                      ),
                    ),
                )
              : Observable.empty(),
        )
        .subscribe(),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  consumeCurrentWorkingDirectory(api: CwdApi): IDisposable {
    let pkg = this;
    const cwdSubscription = api.observeCwd(directory => {
      invariant(pkg != null, 'callback invoked after package deactivated');
      pkg._actionCreators.setProjectRoot(directory);
    });
    this._disposables.add(cwdSubscription, () => {
      pkg = null;
    });
    return new UniversalDisposable(() => {
      if (pkg != null) {
        cwdSubscription.dispose();
        pkg._disposables.remove(cwdSubscription);
        pkg._actionCreators.setProjectRoot(null);
      }
    });
  }

  consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
    const toolBar = getToolBar('nuclide-task-runner');
    toolBar.addSpacer({
      priority: 400,
    });
    const {element} = toolBar.addButton({
      callback: 'nuclide-task-runner:toggle-toolbar-visibility',
      tooltip: 'Toggle Task Runner Toolbar',
      iconset: 'ion',
      icon: 'play',
      priority: 401,
    });
    element.className += ' nuclide-task-runner-tool-bar-button';

    const buttonUpdatesDisposable = new UniversalDisposable(
      observableFromReduxStore(this._store).subscribe((state: AppState) => {
        if (state.taskRunners.count() > 0) {
          element.removeAttribute('hidden');
        } else {
          element.setAttribute('hidden', 'hidden');
        }
      }),
    );

    // Remove the button from the toolbar.
    const buttonPresenceDisposable = new UniversalDisposable(() => {
      toolBar.removeItems();
    });

    // If this package is disabled, stop updating the button and remove it from the toolbar.
    this._disposables.add(buttonUpdatesDisposable, buttonPresenceDisposable);

    // If tool-bar is disabled, stop updating the button state and remove tool-bar related cleanup
    // from this package's disposal actions.
    return new UniversalDisposable(() => {
      buttonUpdatesDisposable.dispose();
      this._disposables.remove(buttonUpdatesDisposable);
      this._disposables.remove(buttonPresenceDisposable);
    });
  }

  consumeConsole(service: ConsoleService): IDisposable {
    let pkg = this;
    this._disposables.add(() => {
      pkg = null;
    });
    this._actionCreators.setConsoleService(service);
    return new UniversalDisposable(() => {
      if (pkg != null) {
        pkg._actionCreators.setConsoleService(null);
      }
    });
  }

  provideTaskRunnerServiceApi(): TaskRunnerServiceApi {
    let pkg = this;
    this._disposables.add(() => {
      pkg = null;
    });
    return {
      register: (taskRunner: TaskRunner) => {
        invariant(
          pkg != null,
          'Task runner service API used after deactivation',
        );
        pkg._actionCreators.registerTaskRunner(taskRunner);
        return new UniversalDisposable(() => {
          if (pkg != null) {
            pkg._actionCreators.unregisterTaskRunner(taskRunner);
          }
        });
      },
      printToConsole: (message: Message, taskRunner: TaskRunner) => {
        invariant(
          pkg != null,
          'Task runner service API used after deactivation',
        );
        this._store.dispatch({
          type: Actions.TASK_MESSAGE,
          payload: {
            taskRunner,
            message,
          },
        });
      },
    };
  }

  serialize(): SerializedAppState {
    const state = this._store.getState();
    return {
      previousSessionVisible: state.visible,
      version: SERIALIZED_VERSION,
    };
  }

  getDistractionFreeModeProvider(): DistractionFreeModeProvider {
    let pkg = this;
    this._disposables.add(() => {
      pkg = null;
    });
    return {
      name: 'nuclide-task-runner',
      isVisible() {
        invariant(pkg != null);
        return pkg._store.getState().visible;
      },
      toggle() {
        invariant(pkg != null);
        pkg._actionCreators.requestToggleToolbarVisibility();
      },
    };
  }
}

createPackage(module.exports, Activation);

function activateInitialPackagesObservable(): Observable<void> {
  if (atom.packages.hasActivatedInitialPackages) {
    return Observable.of(undefined);
  }
  return observableFromSubscribeFunction(
    atom.packages.onDidActivateInitialPackages.bind(atom.packages),
  );
}

function getInitialVisibility(
  serializedState: ?SerializedAppState,
  preferencesForWorkingRoots: LocalStorageJsonTable<?ToolbarStatePreference>,
): boolean {
  // Unfortunately, since we haven't yet been connected to the current working directory service,
  //  we don't know what root to check the previous visibility of. We could just assume it's
  // `atom.project.getDirectories()[0]`, but using explicitly serialized package state is better.
  if (
    serializedState &&
    typeof serializedState.previousSessionVisible === 'boolean'
  ) {
    return serializedState.previousSessionVisible;
  } else {
    // This collection of roots wasn't seen before.
    // Just fall back to the state of the last known session.
    const entries = preferencesForWorkingRoots.getEntries();
    const lastEntry = entries[entries.length - 1];
    if (!lastEntry || !lastEntry.value) {
      return false;
    }
    return lastEntry.value.visible;
  }
}
