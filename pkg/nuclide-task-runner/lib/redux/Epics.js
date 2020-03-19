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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  Action,
  AppState,
  EpicOptions,
  Store,
  TaskMetadata,
  TaskRunner,
  TaskOptions,
  TaskRunnerState,
} from '../types';
import textFromOutcomeAction from './textFromOutcomeAction';
import type {ActionsObservable} from 'nuclide-commons/redux-observable';

import {isConsoleVisible} from 'nuclide-commons-atom/pane-item';
import {compact} from 'nuclide-commons/observable';
import {ProcessExitError} from 'nuclide-commons/process';
import {observableFromTask} from '../../../commons-node/tasks';
import {trackEvent} from 'nuclide-analytics';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getLogger} from 'log4js';
import * as Actions from './Actions';
import * as Immutable from 'immutable';
import invariant from 'assert';
import nullthrows from 'nullthrows';
import {Observable, Scheduler} from 'rxjs';

export function setProjectRootForNewTaskRunnerEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.REGISTER_TASK_RUNNER).mergeMap(action => {
    invariant(action.type === Actions.REGISTER_TASK_RUNNER);
    const {taskRunner} = action.payload;
    const unregistered = actions.filter(
      a =>
        a.type === Actions.UNREGISTER_TASK_RUNNER &&
        a.payload.taskRunner === taskRunner,
    );
    const {projectRoot, initialPackagesActivated} = store.getState();
    if (!initialPackagesActivated || projectRoot == null) {
      return Observable.empty();
    }
    return getTaskRunnerState(taskRunner, projectRoot)
      .map(result =>
        Actions.setStateForTaskRunner(
          result.taskRunner,
          result.taskRunnerState,
        ),
      )
      .takeUntil(unregistered);
  });
}

export function setConsolesForTaskRunnersEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.SET_CONSOLE_SERVICE).switchMap(() => {
    const {consoleService} = store.getState();
    if (consoleService == null) {
      return Observable.empty();
    }

    const consolesForTaskRunners = store
      .getState()
      .taskRunners.map(runner => [
        runner,
        consoleService({id: runner.id, name: runner.name}),
      ]);
    return Observable.of(
      Actions.setConsolesForTaskRunners(Immutable.Map(consolesForTaskRunners)),
    );
  });
}

export function addConsoleForTaskRunnerEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.REGISTER_TASK_RUNNER).switchMap(action => {
    const {consoleService} = store.getState();
    if (consoleService == null) {
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
    const {consoleService} = store.getState();
    if (consoleService == null) {
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
  return actions
    .filter(
      action =>
        action.type === Actions.SET_STATES_FOR_TASK_RUNNERS ||
        action.type === Actions.SET_STATE_FOR_TASK_RUNNER ||
        (action.type === Actions.UNREGISTER_TASK_RUNNER &&
          action.payload.taskRunner === store.getState().activeTaskRunner),
    )
    .switchMap(action => {
      const {projectRoot} = store.getState();

      if (projectRoot == null) {
        return Observable.of(Actions.selectTaskRunner(null, false));
      }

      const {
        activeTaskRunner,
        taskRunners,
        statesForTaskRunners,
      } = store.getState();
      const {preferencesForWorkingRoots} = options;
      const preference = preferencesForWorkingRoots.getItem(projectRoot);

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
      if (
        !taskRunner ||
        (taskRunner === activeTaskRunner &&
          action.type === Actions.UNREGISTER_TASK_RUNNER)
      ) {
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
  return actions
    .ofType(Actions.SET_PROJECT_ROOT, Actions.DID_ACTIVATE_INITIAL_PACKAGES)
    .switchMap(() => {
      const {
        projectRoot,
        taskRunners,
        initialPackagesActivated,
      } = store.getState();

      if (!initialPackagesActivated) {
        return Observable.empty();
      }

      if (taskRunners.count() === 0) {
        return Observable.of(Actions.setStatesForTaskRunners(Immutable.Map()));
      }

      const runnersAndStates = taskRunners.map(taskRunner =>
        getTaskRunnerState(taskRunner, projectRoot),
      );

      return Observable.from(runnersAndStates)
        .combineAll()
        .map(tuples => {
          const statesForTaskRunners = new Map();
          tuples.forEach(result => {
            if (store.getState().taskRunners.includes(result.taskRunner)) {
              statesForTaskRunners.set(
                result.taskRunner,
                result.taskRunnerState,
              );
            }
          });
          return Actions.setStatesForTaskRunners(
            Immutable.Map(statesForTaskRunners),
          );
        });
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

      // eslint-disable-next-line eqeqeq
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
        preferencesForWorkingRoots.setItem(projectRoot, {
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

      if (updateUserPreferences && projectRoot != null && activeTaskRunner) {
        // The user explicitly selected this task runner, remember this state
        const {preferencesForWorkingRoots} = options;
        const updatedPreference = {
          visible: true,
          taskRunnerId: activeTaskRunner.id,
        };
        preferencesForWorkingRoots.setItem(projectRoot, updatedPreference);
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
      const {taskRunner, taskMeta, options} = action.payload;
      const unsavedEditors = atom.workspace
        .getTextEditors()
        .filter(editor => editor.getPath() != null && editor.isModified());

      // Everything saved? Run it!
      if (unsavedEditors.length === 0) {
        return Observable.of(
          Actions.runTask(taskRunner, taskMeta, options, false),
        );
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
                .map(editor => editor.save()),
            );
          });
          return Observable.concat(
            saveAll.ignoreElements(),
            Observable.of(Actions.runTask(taskRunner, taskMeta, options)),
          ).catch(err => {
            atom.notifications.addError(
              'An unexpected error occurred while saving the files.',
              {dismissable: true, detail: err.stack.toString()},
            );
            return Observable.empty();
          });
        }
        return Observable.of(
          Actions.runTask(taskRunner, taskMeta, options, false),
        );
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

      const {taskMeta, taskRunner, options} = action.payload;
      const {activeTaskRunner} = state;

      return Observable.concat(
        stopRunningTask
          ? Observable.of(Actions.stopTask())
          : Observable.empty(),
        activeTaskRunner === taskRunner
          ? Observable.empty()
          : Observable.of(Actions.selectTaskRunner(taskRunner, true)),
        store.getState().visible
          ? Observable.empty()
          : Observable.of(Actions.setToolbarVisibility(true, true)),
        Observable.defer(() => {
          if (taskMeta.disabled) {
            return Observable.empty();
          }

          return (
            createTaskObservable(taskRunner, taskMeta, options, store.getState)
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

export function trackEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<empty> {
  const trackingEvents = actions
    .map(action => {
      switch (action.type) {
        case Actions.TASK_STARTED:
          return {
            type: 'nuclide-task-runner:task-started',
            data: getTaskTrackEventData(action, store.getState()),
          };
        case Actions.TASK_STOPPED:
          return {
            type: 'nuclide-task-runner:task-stopped',
            data: getTaskTrackEventData(action, store.getState()),
          };
        case Actions.TASK_COMPLETED:
          return {
            type: 'nuclide-task-runner:task-completed',
            data: getTaskTrackEventData(action, store.getState()),
          };

        case Actions.TASK_ERRORED:
          return {
            type: 'nuclide-task-runner:task-errored',
            data: getTaskTrackEventData(action, store.getState()),
          };
        case Actions.SET_TOOLBAR_VISIBILITY:
          const visible = action.payload.visible;
          return visible
            ? {type: 'nuclide-task-runner:show'}
            : {type: 'nuclide-task-runner: hide'};
        default:
          return null;
      }
    })
    .let(compact);

  return trackingEvents.do(trackEvent).ignoreElements();
}

function getTaskTrackEventData(action: Action, state: AppState): Object {
  invariant(
    action.type === Actions.TASK_STARTED ||
      action.type === Actions.TASK_STOPPED ||
      action.type === Actions.TASK_COMPLETED ||
      action.type === Actions.TASK_ERRORED,
  );
  const {activeTaskRunner, projectRoot} = state;
  invariant(projectRoot != null);
  invariant(activeTaskRunner);
  const {taskStatus} = action.payload;
  const {task} = taskStatus;
  const taskTrackingData =
    // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
    typeof task.getTrackingData === 'function' ? task.getTrackingData() : {};
  const error =
    action.type === Actions.TASK_ERRORED ? action.payload.error : null;
  const duration =
    action.type === Actions.TASK_STARTED
      ? null
      : new Date().getTime() -
        parseInt(action.payload.taskStatus.startDate.getTime(), 10);
  return {
    ...taskTrackingData,
    projectRoot,
    taskRunnerId: activeTaskRunner.id,
    taskType: taskStatus.metadata.type,
    errorMessage: error != null ? error.message : null,
    stackTrace: error != null ? String(error.stack) : null,
    duration,
  };
}

export function printTaskCanceledEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.TASK_STOPPED).map(action => {
    invariant(action.type === Actions.TASK_STOPPED);
    const {taskRunner} = action.payload;
    return {
      type: Actions.TASK_MESSAGE,
      payload: {
        message: {text: textFromOutcomeAction(action), level: 'warning'},
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
    const {taskRunner} = action.payload;
    return {
      type: Actions.TASK_MESSAGE,
      payload: {
        message: {text: textFromOutcomeAction(action), level: 'success'},
        taskRunner,
      },
    };
  });
}

export function printTaskErroredEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.TASK_ERRORED).switchMap(action => {
    invariant(action.type === Actions.TASK_ERRORED);
    const {
      error,
      taskRunner,
      taskStatus: {
        metadata: {label},
      },
    } = action.payload;

    let description;
    let buttons;
    if (error instanceof ProcessExitError) {
      description = formatProcessExitError(error);
      buttons = [
        {
          text: 'Copy command',
          className: 'icon icon-clippy',
          onDidClick: () =>
            atom.clipboard.write(error.command + ' ' + error.args.join(' ')),
        },
      ];
    } else {
      description = error.message;
    }

    // Show error notification only if console is not visible. The error message
    // is automatically forwarded to the nuclide console in this case through
    // the globally registered `atom.notifications.onDidAddNotification` callback.
    if (!isConsoleVisible()) {
      addAtomErrorNotification(label, buttons, description);
      return Observable.empty();
    }

    // Otherwise if the console is visible, we manually register the error
    // message.
    return Observable.of({
      type: Actions.TASK_MESSAGE,
      payload: {
        message: {
          text: `The task "${label}" failed: ${description}`,
          level: 'error',
        },
        taskRunner,
      },
    });
  });
}

let taskFailedNotification;

function addAtomErrorNotification(
  label: string,
  buttons: $PropertyType<atom$NotificationOptions, 'buttons'>,
  description: string,
): void {
  taskFailedNotification = atom.notifications.addError(
    `The task "${label}" failed`,
    {
      buttons,
      description,
      dismissable: true,
    },
  );

  taskFailedNotification.onDidDismiss(() => {
    taskFailedNotification = null;
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

/**
 * Run a task and transform its output into domain-specific actions.
 */
function createTaskObservable(
  taskRunner: TaskRunner,
  taskMeta: TaskMetadata,
  options: ?TaskOptions,
  getState: () => AppState,
): Observable<Action> {
  return Observable.defer(() => {
    // dismiss any non-dismissed notification
    if (taskFailedNotification != null) {
      taskFailedNotification.dismiss();
    }
    const task = taskRunner.runTask(taskMeta.type, options);
    const taskStatus = {
      metadata: taskMeta,
      task,
      progress: null,
      status: null,
      startDate: new Date(),
    };
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
          } else if (event.type === 'status') {
            return Observable.of({
              type: Actions.TASK_STATUS,
              payload: {status: event.status},
            });
          } else if (event.type === 'message') {
            return Observable.of({
              type: Actions.TASK_MESSAGE,
              payload: {
                message: event.message,
                taskRunner,
              },
            });
          } else if (event.type === 'status' && event.status != null) {
            return Observable.of({
              type: Actions.TASK_MESSAGE,
              payload: {
                message: {text: event.status, level: 'info'},
                taskRunner,
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
            taskRunner,
          },
        }),
      );
  })
    .catch(error => {
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
          taskRunner,
          taskStatus: nullthrows(getState().runningTask),
        },
      });
    })
    .share();
}

function getBestEffortTaskRunner(
  taskRunners: Immutable.List<TaskRunner>,
  statesForTaskRunners: Immutable.Map<TaskRunner, TaskRunnerState>,
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
        description: `Do you want to save them before running the ${
          taskMeta.label
        } task?`,
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

function getTaskRunnerState(
  taskRunner: TaskRunner,
  projectRoot: ?NuclideUri,
): Observable<{taskRunner: TaskRunner, taskRunnerState: TaskRunnerState}> {
  return (
    Observable.create(
      observer =>
        new UniversalDisposable(
          taskRunner.setProjectRoot(projectRoot, (enabled, tasks) => {
            observer.next({
              taskRunner,
              taskRunnerState: {enabled, tasks: enabled ? tasks : []},
            });
          }),
        ),
    )
      // Process task runner updates on the next tick rather than immediately.
      // Otherwise if active task runner changes, the new task runner could synchronously send
      // a state update before epics are fully processed.
      .observeOn(Scheduler.asap)
      // We need the initial state to return within reasonable time, otherwise the toolbar hangs.
      // We don't want to start with all runners disabled because it causes UI jumps
      // when a preferred runner gets enabled after a non-preferred one.
      .race(
        Observable.timer(10000).switchMap(() =>
          Observable.throw('Enabling timed out'),
        ),
      )
      .catch(error => {
        getLogger('nuclide-task-runner').error(
          `Disabling ${
            taskRunner.name
          } task runner, because setProjectRoot failed.\n\n${error}`,
        );
        return Observable.of({
          taskRunner,
          taskRunnerState: {enabled: false, tasks: []},
        });
      })
  );
}

function formatProcessExitError(error: ProcessExitError): string {
  let message = '```\n';
  message += error.command + ' ' + error.args.join(' ');
  message += '\n```\n<br />';
  if (error.stderr !== '') {
    message += 'Stderr:\n';
    message += '```\n';
    message += error.stderr;
    message += '\n```\n<br />';
  }
  if (error.exitCode != null) {
    message += `Exit code: ${error.exitCode}\n<br />`;
  } else if (error.signal != null) {
    message += `Signal: ${error.signal}\n<br />`;
  }
  return message;
}
