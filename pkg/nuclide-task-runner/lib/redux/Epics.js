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
  Action,
  AppState,
  EpicOptions,
  Store,
  TaskMetadata,
  TaskRunner,
  TaskRunnerState,
} from '../types';
import type {ActionsObservable} from '../../../commons-node/redux-observable';

import {saveBuffer} from '../../../nuclide-remote-connection';
import {observableFromTask} from '../../../commons-node/tasks';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getLogger} from 'log4js';
import * as Actions from './Actions';
import invariant from 'assert';
import nullthrows from 'nullthrows';
import {Observable} from 'rxjs';

export function setProjectRootEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return (
    actions
      .ofType(
        Actions.REGISTER_TASK_RUNNER,
        Actions.UNREGISTER_TASK_RUNNER,
        Actions.DID_ACTIVATE_INITIAL_PACKAGES,
      )
      // Refreshes everything. Not the most efficient, but good enough
      .map(() => Actions.setProjectRoot(store.getState().projectRoot))
  );
}

export function setConsolesForTaskRunnersEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.SET_CONSOLE_SERVICE, Actions.DID_ACTIVATE_INITIAL_PACKAGES)
    .switchMap(() => {
      const {consoleService, taskRunnersReady} = store.getState();
      if (consoleService == null || !taskRunnersReady) {
        return Observable.empty();
      }

      const consolesForTaskRunners = store
        .getState()
        .taskRunners.map(runner => [
          runner,
          consoleService({id: runner.name, name: runner.name}),
        ]);
      return Observable.of(
        Actions.setConsolesForTaskRunners(new Map(consolesForTaskRunners)),
      );
    });
}

export function addConsoleForTaskRunnerEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.REGISTER_TASK_RUNNER).switchMap(action => {
    const {consoleService, taskRunnersReady} = store.getState();
    if (consoleService == null || !taskRunnersReady) {
      return Observable.empty();
    }

    invariant(action.type === Actions.REGISTER_TASK_RUNNER);
    const {taskRunner} = action.payload;
    const {id, name} = taskRunner;
    return Observable.of(
      Actions.addConsoleForTaskRunner(taskRunner, consoleService({id, name})),
    );
  });
}

export function removeConsoleForTaskRunnerEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.UNREGISTER_TASK_RUNNER).switchMap(action => {
    const {consoleService, taskRunnersReady} = store.getState();
    if (consoleService == null || !taskRunnersReady) {
      return Observable.empty();
    }

    invariant(action.type === Actions.UNREGISTER_TASK_RUNNER);
    return Observable.of(
      Actions.removeConsoleForTaskRunner(action.payload.taskRunner),
    );
  });
}

export function setActiveTaskRunnerEpic(
  actions: ActionsObservable<Action>,
  store: Store,
  options: EpicOptions,
): Observable<Action> {
  return actions.ofType(Actions.SET_STATES_FOR_TASK_RUNNERS).switchMap(() => {
    const {projectRoot} = store.getState();

    if (!projectRoot) {
      return Observable.of(Actions.selectTaskRunner(null, false));
    }

    const {
      activeTaskRunner,
      taskRunners,
      statesForTaskRunners,
    } = store.getState();
    const {preferencesForWorkingRoots} = options;
    const preference = preferencesForWorkingRoots.getItem(
      projectRoot.getPath(),
    );

    let visibilityAction;
    let taskRunner = activeTaskRunner;

    if (preference) {
      // The user had a session for this root in the past, restore it
      visibilityAction = Observable.of(
        Actions.setToolbarVisibility(preference.visible, false),
      );
      const preferredId = preference.taskRunnerId;
      if (!activeTaskRunner || activeTaskRunner.id !== preferredId) {
        const preferredRunner = taskRunners.find(
          runner => runner.id === preferredId,
        );
        const state =
          preferredRunner && statesForTaskRunners.get(preferredRunner);
        if (state && state.enabled) {
          taskRunner = preferredRunner;
        }
      }
    } else {
      const atLeastOneTaskRunnerEnabled = taskRunners.some(runner => {
        const state = statesForTaskRunners.get(runner);
        return state && state.enabled;
      });
      if (atLeastOneTaskRunnerEnabled) {
        // Advertise the toolbar if there's a chance it's useful at this new working root.
        visibilityAction = Observable.of(
          Actions.setToolbarVisibility(true, true),
        );
      } else {
        visibilityAction = Observable.of(
          Actions.setToolbarVisibility(false, false),
        );
      }
      taskRunner = activeTaskRunner;
    }

    // We have nothing to go with, let's make best effort to select a task runner
    if (!taskRunner) {
      taskRunner = getBestEffortTaskRunner(taskRunners, statesForTaskRunners);
    }

    return Observable.concat(
      Observable.of(Actions.selectTaskRunner(taskRunner, false)),
      visibilityAction,
    );
  });
}

export function combineTaskRunnerStatesEpic(
  actions: ActionsObservable<Action>,
  store: Store,
  options: EpicOptions,
): Observable<Action> {
  return actions.ofType(Actions.SET_PROJECT_ROOT).switchMap(() => {
    const {projectRoot, taskRunners, taskRunnersReady} = store.getState();

    if (!taskRunnersReady) {
      // We will dispatch another set project root when everyone is ready.
      return Observable.empty();
    }

    if (taskRunners.length === 0) {
      return Observable.of(Actions.setStatesForTaskRunners(new Map()));
    }

    // This depends on the epic above, triggering setProjectRoot when taskRunners change
    const runnersAndStates = taskRunners.map(taskRunner =>
      Observable.create(
        observer =>
          new UniversalDisposable(
            taskRunner.setProjectRoot(projectRoot, (enabled, tasks) => {
              observer.next([
                taskRunner,
                {enabled, tasks: enabled ? tasks : []},
              ]);
            }),
          ),
      ),
    );

    return (
      Observable.from(runnersAndStates)
        // $FlowFixMe: type combineAll
        .combineAll()
        .map(tuples => {
          const statesForTaskRunners = new Map();
          tuples.forEach(([taskRunner, state]) => {
            statesForTaskRunners.set(taskRunner, state);
          });
          return statesForTaskRunners;
        })
        .map(statesForTaskRunners =>
          Actions.setStatesForTaskRunners(statesForTaskRunners),
        )
    );
  });
}

export function toggleToolbarVisibilityEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.REQUEST_TOGGLE_TOOLBAR_VISIBILITY)
    .flatMap(action => {
      invariant(action.type === Actions.REQUEST_TOGGLE_TOOLBAR_VISIBILITY);
      const state = store.getState();
      const {activeTaskRunner, projectRoot} = state;
      const currentlyVisible = state.visible;
      const {visible, taskRunner} = action.payload;

      if (visible === true || (visible === null && !currentlyVisible)) {
        if (projectRoot == null) {
          atom.notifications.addError(
            'Add a project to use the task runner toolbar',
            {
              dismissable: true,
            },
          );
          return Observable.empty();
        } else if (activeTaskRunner == null) {
          atom.notifications.addError(
            'No task runner available for the current working root selected in file tree',
            {
              dismissable: true,
            },
          );
          return Observable.of(Actions.setToolbarVisibility(false, true));
        }
      }
      return Observable.of(
        Actions.toggleToolbarVisibility(visible, taskRunner),
      );
    });
}

export function updatePreferredVisibilityEpic(
  actions: ActionsObservable<Action>,
  store: Store,
  options: EpicOptions,
): Observable<Action> {
  return actions
    .ofType(Actions.SET_TOOLBAR_VISIBILITY)
    .do(action => {
      invariant(action.type === Actions.SET_TOOLBAR_VISIBILITY);
      const {visible, updateUserPreferences} = action.payload;
      const {projectRoot, activeTaskRunner} = store.getState();

      // Only act if responding to an explicit user action
      if (
        updateUserPreferences &&
        projectRoot != null &&
        activeTaskRunner != null
      ) {
        // The user explicitly changed the visibility, remember this state
        const {preferencesForWorkingRoots} = options;
        preferencesForWorkingRoots.setItem(projectRoot.getPath(), {
          taskRunnerId: activeTaskRunner.id,
          visible,
        });
      }
    })
    .ignoreElements();
}

export function updatePreferredTaskRunnerEpic(
  actions: ActionsObservable<Action>,
  store: Store,
  options: EpicOptions,
): Observable<Action> {
  return actions
    .ofType(Actions.SELECT_TASK_RUNNER)
    .do(action => {
      invariant(action.type === Actions.SELECT_TASK_RUNNER);
      const {updateUserPreferences} = action.payload;
      const {projectRoot, activeTaskRunner} = store.getState();

      if (updateUserPreferences && projectRoot && activeTaskRunner) {
        // The user explicitly selected this task runner, remember this state
        const {preferencesForWorkingRoots} = options;
        const updatedPreference = {
          visible: true,
          taskRunnerId: activeTaskRunner.id,
        };
        preferencesForWorkingRoots.setItem(
          projectRoot.getPath(),
          updatedPreference,
        );
      }
    })
    .ignoreElements();
}

/**
 * Verifies that all the files are saved prior to running a task.
 */
export function verifySavedBeforeRunningTaskEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .filter(
      action =>
        action.type === Actions.RUN_TASK && action.payload.verifySaved === true,
    )
    .switchMap(action => {
      invariant(action.type === Actions.RUN_TASK);
      const {taskMeta} = action.payload;
      const unsavedEditors = atom.workspace
        .getTextEditors()
        .filter(editor => editor.getPath() != null && editor.isModified());

      // Everything saved? Run it!
      if (unsavedEditors.length === 0) {
        return Observable.of(Actions.runTask(taskMeta, false));
      }

      return promptForShouldSave(taskMeta).switchMap(shouldSave => {
        if (shouldSave) {
          const saveAll = Observable.defer(() => {
            const stillUnsaved = atom.workspace
              .getTextEditors()
              .filter(
                editor => editor.getPath() != null && editor.isModified(),
              );
            return Promise.all(
              unsavedEditors
                .filter(editor => stillUnsaved.indexOf(editor) !== -1)
                .map(editor => saveBuffer(editor.getBuffer())),
            );
          });
          return Observable.concat(
            saveAll.ignoreElements(),
            Observable.of(Actions.runTask(taskMeta)),
          ).catch(err => {
            atom.notifications.addError(
              'An unexpected error occurred while saving the files.',
              {dismissable: true, detail: err.stack.toString()},
            );
            return Observable.empty();
          });
        }
        return Observable.of(Actions.runTask(taskMeta, false));
      });
    });
}

export function runTaskEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .filter(
      action =>
        action.type === Actions.RUN_TASK &&
        action.payload.verifySaved === false,
    )
    .switchMap(action => {
      invariant(action.type === Actions.RUN_TASK);
      const state = store.getState();
      const stopRunningTask = state.runningTask != null;

      const {taskMeta} = action.payload;
      const {activeTaskRunner} = state;
      const newTaskRunner = taskMeta.taskRunner;

      return Observable.concat(
        stopRunningTask
          ? Observable.of(Actions.stopTask())
          : Observable.empty(),
        activeTaskRunner === newTaskRunner
          ? Observable.empty()
          : Observable.of(Actions.selectTaskRunner(newTaskRunner, true)),
        store.getState().visible
          ? Observable.empty()
          : Observable.of(Actions.setToolbarVisibility(true, true)),
        Observable.defer(() => {
          if (taskMeta.disabled) {
            return Observable.empty();
          }

          return (
            createTaskObservable(taskMeta, store.getState)
              // Stop listening once the task is done.
              .takeUntil(
                actions.ofType(
                  Actions.TASK_COMPLETED,
                  Actions.TASK_ERRORED,
                  Actions.TASK_STOPPED,
                ),
              )
          );
        }),
      );
    });
}

export function stopTaskEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.STOP_TASK).switchMap(action => {
    const {activeTaskRunner, runningTask} = store.getState();
    if (!runningTask) {
      return Observable.empty();
    }
    invariant(activeTaskRunner);
    return Observable.of({
      type: Actions.TASK_STOPPED,
      payload: {taskStatus: runningTask, taskRunner: activeTaskRunner},
    });
  });
}

export function setToolbarVisibilityEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.TOGGLE_TOOLBAR_VISIBILITY).switchMap(action => {
    invariant(action.type === Actions.TOGGLE_TOOLBAR_VISIBILITY);
    const state = store.getState();
    const {activeTaskRunner, statesForTaskRunners} = state;
    const {visible, taskRunner} = action.payload;

    // If changing to a new task runner, select it and show it.
    if (taskRunner != null) {
      const taskRunnerState = statesForTaskRunners.get(taskRunner);
      if (
        taskRunnerState != null &&
        taskRunnerState.enabled &&
        taskRunner !== activeTaskRunner
      ) {
        return Observable.of(
          Actions.selectTaskRunner(taskRunner, true),
          Actions.setToolbarVisibility(visible != null ? visible : true, true),
        );
      }
    }

    // Otherwise, just toggle the visibility (unless the "visible" override is provided).
    return Observable.of(
      Actions.setToolbarVisibility(
        visible != null ? visible : !state.visible,
        true,
      ),
    );
  });
}

export function printTaskCancelledEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.TASK_STOPPED).map(action => {
    invariant(action.type === Actions.TASK_STOPPED);
    const {type} = action.payload.taskStatus.metadata;
    const {taskRunner} = action.payload;
    const capitalizedType = type.slice(0, 1).toUpperCase() + type.slice(1);
    return {
      type: Actions.TASK_MESSAGE,
      payload: {
        message: {text: `${capitalizedType} cancelled.`, level: 'warning'},
        taskRunner,
      },
    };
  });
}

export function printTaskSucceededEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.TASK_COMPLETED).map(action => {
    invariant(action.type === Actions.TASK_COMPLETED);
    const {type} = action.payload.taskStatus.metadata;
    const {taskRunner} = action.payload;
    const capitalizedType = type.slice(0, 1).toUpperCase() + type.slice(1);
    return {
      type: Actions.TASK_MESSAGE,
      payload: {
        message: {text: `${capitalizedType} succeeded.`, level: 'success'},
        taskRunner,
      },
    };
  });
}

export function appendMessageToConsoleEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions
    .ofType(Actions.TASK_MESSAGE)
    .do(action => {
      invariant(action.type === Actions.TASK_MESSAGE);
      const {message, taskRunner} = action.payload;
      const consoleApi = store
        .getState()
        .consolesForTaskRunners.get(taskRunner);
      if (consoleApi) {
        consoleApi.append({...message});
      }
    })
    .ignoreElements();
}

let taskFailedNotification;

/**
 * Run a task and transform its output into domain-specific actions.
 */
function createTaskObservable(
  taskMeta: TaskMetadata & {taskRunner: TaskRunner},
  getState: () => AppState,
): Observable<Action> {
  return Observable.defer(() => {
    if (taskFailedNotification != null) {
      taskFailedNotification.dismiss();
    }
    const task = taskMeta.taskRunner.runTask(taskMeta.type);
    const taskStatus = {metadata: taskMeta, task};
    const events = observableFromTask(task);

    return Observable.of({
      type: Actions.TASK_STARTED,
      payload: {taskStatus},
    })
      .concat(
        events.flatMap(event => {
          if (event.type === 'progress') {
            return Observable.of({
              type: Actions.TASK_PROGRESS,
              payload: {progress: event.progress},
            });
          } else if (event.type === 'message') {
            return Observable.of({
              type: Actions.TASK_MESSAGE,
              payload: {
                message: event.message,
                taskRunner: taskMeta.taskRunner,
              },
            });
          } else if (event.type === 'status' && event.status != null) {
            return Observable.of({
              type: Actions.TASK_MESSAGE,
              payload: {
                message: {text: event.status, level: 'info'},
                taskRunner: taskMeta.taskRunner,
              },
            });
          } else {
            return Observable.empty();
          }
        }),
      )
      .concat(
        Observable.of({
          type: Actions.TASK_COMPLETED,
          payload: {
            taskStatus: {...taskStatus, progress: 1},
            taskRunner: taskMeta.taskRunner,
          },
        }),
      );
  })
    .catch(error => {
      taskFailedNotification = atom.notifications.addError(
        `The task "${taskMeta.label}" failed`,
        {
          description: error.message,
          dismissable: true,
        },
      );
      taskFailedNotification.onDidDismiss(() => {
        taskFailedNotification = null;
      });
      const taskMetaForLogging = {...taskMeta, taskRunner: undefined};
      getLogger('nuclide-task-runner').debug(
        'Error running task:',
        taskMetaForLogging,
        error,
      );
      return Observable.of({
        type: Actions.TASK_ERRORED,
        payload: {
          error,
          taskStatus: nullthrows(getState().runningTask),
        },
      });
    })
    .share();
}

function getBestEffortTaskRunner(
  taskRunners: Array<TaskRunner>,
  statesForTaskRunners: Map<TaskRunner, TaskRunnerState>,
): ?TaskRunner {
  return taskRunners.reduce((memo, runner) => {
    const state = statesForTaskRunners.get(runner);
    // Disabled task runners aren't selectable
    if (!state || !state.enabled) {
      return memo;
    }
    // Select at least something
    if (memo == null) {
      return runner;
    }

    // Highest priority wins
    const memoPriority = (memo.getPriority && memo.getPriority()) || 0;
    const runnerPriority = (runner.getPriority && runner.getPriority()) || 0;
    if (runnerPriority > memoPriority) {
      return runner;
    }
    return memo;
  }, null);
}

/**
 * Returns an observable that:
 *   - prompts for whether the files should be saved before running the given task when subscribed
 *   - contains 0 or 1 elements:
 *       - `true` if the file should be saved before running
 *       - `false` if it shouldn't be
 *       - nothing if the user decides to cancel
 *   - dismisses the notification when unsubscribed
 */
function promptForShouldSave(taskMeta: TaskMetadata): Observable<boolean> {
  return Observable.create(observer => {
    let notification = atom.notifications.addInfo(
      'You have files with unsaved changes.',
      {
        dismissable: true,
        description: `Do you want to save them before running the ${taskMeta.label} task?`,
        buttons: [
          {
            text: `Save All & ${taskMeta.label}`,
            onDidClick() {
              observer.next(true);
              observer.complete();
            },
          },
          {
            text: `${taskMeta.label} Without Saving`,
            onDidClick() {
              observer.next(false);
              observer.complete();
            },
          },
          {
            text: 'Cancel',
            className: 'icon icon-circle-slash',
            onDidClick() {
              observer.complete();
            },
          },
        ],
      },
    );
    return () => {
      invariant(notification != null);
      notification.dismiss();
      notification = null;
    };
  });
}
