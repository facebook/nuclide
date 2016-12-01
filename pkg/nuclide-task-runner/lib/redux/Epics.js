'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  AnnotatedTaskMetadata,
  Action,
  AppState,
  Store,
  TaskMetadata,
  TaskRunner,
} from '../types';
import type {ActionsObservable} from '../../../commons-node/redux-observable';

import {observableFromTask} from '../../../commons-node/tasks';
import {observableFromSubscribeFunction} from '../../../commons-node/event';
import {diffSets} from '../../../commons-node/observable';
import UniversalDisposable from '../../../commons-node/UniversalDisposable';
import {getLogger} from '../../../nuclide-logging';
import {getTaskMetadata} from '../getTaskMetadata';
import {getActiveTaskId, getActiveTaskRunner} from '../redux/Selectors';
import {taskIdsAreEqual} from '../taskIdsAreEqual';
import * as Actions from './Actions';
import invariant from 'assert';
import {Observable} from 'rxjs';

export function aggregateTaskListsEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  // Wait until the initial packages have loaded.
  return actions.ofType(Actions.DID_LOAD_INITIAL_PACKAGES)
    .switchMap(() => {
      // We get the state stream from the state. Ideally, we'd just use `Observable.from(store)`,
      // but Redux gives us a partial store so we have to work around it.
      // See redux-observable/redux-observable#56
      const {states} = store.getState();

      const projectRoots = store.getState().states.map(state => state.projectRoot)
        .distinctUntilChanged((a, b) => {
          const aPath = a && a.getPath();
          const bPath = b && b.getPath();
          return aPath === bPath;
        });
      const taskRunnersByIdStream: Observable<Map<string, TaskRunner>> = states
        .map(state => state.taskRunners)
        .distinctUntilChanged();

      const diffs = Observable.merge(
        // We want to make sure that we don't call `observeTaskList()` when nothing's changed, so we
        // use `diffSets()` to identify changes.
        diffSets(taskRunnersByIdStream.map(taskRunnersById => new Set(taskRunnersById.keys()))),
        // If the project root changes, get tasks from all of them.
        projectRoots
          .skip(1)
          .switchMap(() => {
            const taskRunnerIds = new Set(store.getState().taskRunners.keys());
            return Observable.of(
              {added: new Set(), removed: taskRunnerIds},
              {added: taskRunnerIds, removed: new Set()},
            );
          }),
      )
        .share();

      // Create a stream containing the task list updates, tagged by task runner id.
      const taskListsByIdStream: Observable<Map<string, Array<AnnotatedTaskMetadata>>> = diffs
        .mergeMap(({added}) => (
          // Get an observable of task lists for each task runner. Tag it with the task runner id
          // so that we can tie them back later.
          Observable.from(added).mergeMap(taskRunnerId => {
            const taskRunner = store.getState().taskRunners.get(taskRunnerId);
            invariant(taskRunner != null);
            const taskLists = observableFromSubscribeFunction(cb => {
              if (taskRunner.setProjectRoot != null) {
                const {projectRoot} = store.getState();
                invariant(taskRunner.setProjectRoot != null);
                taskRunner.setProjectRoot(projectRoot);
              }
              return taskRunner.observeTaskList(cb);
            })
              // Stop listening to the task list when the runner's removed or the project root
              // changes.
              .takeUntil(diffs.filter(diff => diff.removed.has(taskRunnerId)))
              .map(taskList => {
                // Annotate each task with some info about its runner.
                const annotatedTaskList = taskList.map(task => ({
                  ...task,
                  taskRunnerId,
                  taskRunnerName: taskRunner.name,
                }));
                // Tag each task list with the id of its runner for adding to the map.
                return {taskRunnerId, taskList: annotatedTaskList};
              })
              // When it completes, null the task list for this task runner.
              .concat(Observable.of({taskRunnerId, taskList: null}))
              .publish();

            // Use `Observable.create()` to make sure we only have one subscription to taskLists and
            // that we don't miss any elements.
            return Observable.create(observer => (
              new UniversalDisposable(
                Observable.merge(
                  taskLists,
                  Observable.of({taskRunnerId, taskList: []})
                    .delay(1000)
                    .takeUntil(taskLists.take(1)),
                )
                  .subscribe(observer),
                taskLists.connect(),
              )
            ));
          })
        ))
        .scan(
          // Combine the lists from each task runner into a single map.
          (acc_, {taskRunnerId, taskList}) => {
            const acc = new Map(acc_);
            if (taskList == null) {
              acc.delete(taskRunnerId);
            } else {
              acc.set(taskRunnerId, taskList);
            }
            return acc;
          },
          new Map(),
        );

      return taskListsByIdStream.map(taskListsById => Actions.setTaskLists(taskListsById));
    });
}

export function runTaskEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.RUN_TASK)
    .switchMap(action => {
      invariant(action.type === Actions.RUN_TASK);
      const taskToRun = action.payload.taskId || getActiveTaskId(store.getState());

      // Don't do anything if there's no active task.
      if (taskToRun == null) { return Observable.empty(); }

      // Don't do anything if a task is already running.
      if (store.getState().runningTaskInfo != null) { return Observable.empty(); }

      return Observable.concat(
        taskIdsAreEqual(store.getState().activeTaskId, taskToRun)
          ? Observable.empty()
          : Observable.of(Actions.selectTask(taskToRun)),
        store.getState().visible
          ? Observable.empty()
          : Observable.of(Actions.setToolbarVisibility(true)),
        Observable.defer(() => {
          const state = store.getState();
          const activeTaskRunner = getActiveTaskRunner(state);

          if (activeTaskRunner == null) {
            return Observable.empty();
          }

          const taskMeta = getTaskMetadata(taskToRun, state.taskLists);
          invariant(taskMeta != null);

          if (!taskMeta.runnable) {
            return Observable.empty();
          }

          return createTaskObservable(activeTaskRunner, taskMeta, () => store.getState())
            // Stop listening once the task is done.
            .takeUntil(
              actions.ofType(Actions.TASK_COMPLETED, Actions.TASK_ERRORED, Actions.TASK_STOPPED),
            );
        }),
      );
    });
}

export function stopTaskEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.STOP_TASK)
    .switchMap(action => {
      const {runningTaskInfo} = store.getState();
      const task = runningTaskInfo == null ? null : runningTaskInfo.task;
      if (task == null) { return Observable.empty(); }
      return Observable.of({
        type: Actions.TASK_STOPPED,
        payload: {task},
      });
    });
}

export function toggleToolbarVisibilityEpic(
  actions: ActionsObservable<Action>,
  store: Store,
): Observable<Action> {
  return actions.ofType(Actions.TOGGLE_TOOLBAR_VISIBILITY)
    .switchMap(action => {
      invariant(action.type === Actions.TOGGLE_TOOLBAR_VISIBILITY);
      const state = store.getState();
      const {taskRunnerId} = action.payload;

      // If no taskRunnerId is provided, just toggle the visibility.
      if (taskRunnerId == null) {
        return Observable.of(Actions.setToolbarVisibility(!state.visible));
      }

      // If the active task corresponds to the task runner you want to toggle, just toggle the
      // visibility.
      const {activeTaskId} = state;
      if (activeTaskId != null && activeTaskId.taskRunnerId === taskRunnerId) {
        return Observable.of(Actions.setToolbarVisibility(!state.visible));
      }

      // Choose the first task for that task runner.
      const taskListForRunner = state.taskLists.get(taskRunnerId) || [];
      const taskIdToSelect = taskListForRunner.length > 0 ? taskListForRunner[0] : null;
      if (taskIdToSelect == null) {
        const taskRunner = state.taskRunners.get(taskRunnerId);
        invariant(taskRunner != null);
        atom.notifications.addWarning(`The ${taskRunner.name} task runner doesn't have any tasks!`);
      }

      return Observable.concat(
        // Make sure the toolbar is shown.
        Observable.of(Actions.setToolbarVisibility(true)),

        // Select the task.
        taskIdToSelect == null
          ? Observable.empty()
          : Observable.of(Actions.selectTask(taskIdToSelect)),
      );
    });
}

/**
 * Run a task and transform its output into domain-specific actions.
 */
function createTaskObservable(
  taskRunner: TaskRunner,
  taskMeta: TaskMetadata,
  getState: () => AppState,
): Observable<Action> {
  return Observable.defer(() => {
    const task = taskRunner.runTask(taskMeta.type);
    const events = observableFromTask(task);

    return Observable
      .of({
        type: Actions.TASK_STARTED,
        payload: {task},
      })
      .concat(
        events
          .filter(event => event.type === 'progress')
          .map(event => ({
            type: Actions.TASK_PROGRESS,
            payload: {progress: event.progress},
          })),
      )
      .concat(Observable.of({
        type: Actions.TASK_COMPLETED,
        payload: {task},
      }));
  })
    .catch(error => {
      atom.notifications.addError(
        `The task "${taskMeta.label}" failed`,
        {
          description: error.message,
          dismissable: true,
        },
      );
      getLogger().error('Error running task:', taskMeta, error);
      const {runningTaskInfo} = getState();
      return Observable.of({
        type: Actions.TASK_ERRORED,
        payload: {
          error,
          task: runningTaskInfo == null ? null : runningTaskInfo.task,
        },
      });
    })
    .share();
}
