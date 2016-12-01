/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow
 */

import type {Task} from '../../commons-node/tasks';
import type {Directory} from '../../nuclide-remote-connection';
import type {Observable} from 'rxjs';

export type AppState = {
  // The explicitly selected task. If we're using a fallback, this will be null. Always use the
  // `getActiveTaskId` selector to get the value.
  activeTaskId: ?TaskId,
  taskRunners: Map<string, TaskRunner>,
  previousSessionActiveTaskId: ?TaskId,
  previousSessionVisible: ?boolean,
  projectRoot: ?Directory,
  projectWasOpened: boolean,
  showPlaceholderInitially: boolean,
  states: Observable<AppState>,
  taskLists: Map<string, Array<AnnotatedTaskMetadata>>,
  runningTaskInfo: ?{
    task: Task,
    progress: ?number,
  },
  tasksAreReady: boolean,
  viewIsInitialized: boolean,
  visible: boolean,
};

export type SerializedAppState = {
  previousSessionActiveTaskId: ?TaskId,
  previousSessionVisible: ?boolean,
  version?: number,
};

export type TaskId = {
  type: string,
  taskRunnerId: string,
};

export type TaskMetadata = {
  type: string,
  label: string,
  description: string,
  // Is this task applicable? For backwards compat, this isn't (currently) required, but tasks that
  // have it will be preferred.
  disabled?: boolean,
  // When multiple task runners are applicable, the priority determines the task selected by
  // default. Higher priorities will be taken first; the default is 0.
  // Tasks that do not set `disabled` will have a default priority of -1.
  priority?: number,
  runnable: boolean, // Can the action be run now?
  cancelable?: boolean, // By default, this is true (all tasks are cancelable).
  icon: string,
  iconset?: string,
};

export type AnnotatedTaskMetadata = TaskMetadata & {
  taskRunnerId: string,
  taskRunnerName: string,
};

export type TaskRunner = {
  +id: string,
  +name: string,
  +getExtraUi?: () => ReactClass<any>, // activeTaskType will be provided as a nullable property.
  +observeTaskList: (callback: (taskList: Array<TaskMetadata>) => mixed) => IDisposable,
  +getIcon: () => ReactClass<any>,
  +runTask: (taskName: string) => Task,
  +setProjectRoot?: (projectRoot: ?Directory) => void,
};

export type TaskRunnerInfo = {
  id: string,
  name: string,
};

export type Store = {
  getState(): AppState,
  dispatch(action: Action): void,
};

export type BoundActionCreators = {
  registerTaskRunner(taskRunner: TaskRunner): void,
  runTask(taskId: ?TaskId): void,
  selectTask(taskId: TaskId): void,
  setProjectRoot(dir: ?Directory): void,
  setToolbarVisibility(visible: boolean): void,
  stopTask(): void,
  toggleToolbarVisibility(): void,
  unregisterTaskRunner(taskRunner: TaskRunner): void,
};

//
// Action types.
//

export type DidLoadInitialPackagesAction = {
  type: 'DID_LOAD_INITIAL_PACKAGES',
};

export type SelectTaskAction = {
  type: 'SELECT_TASK',
  payload: {
    taskId: TaskId,
  },
};

export type TaskCompletedAction = {
  type: 'TASK_COMPLETED',
  payload: {
    task: Task,
  },
};

type TaskProgressAction = {
  type: 'TASK_PROGRESS',
  payload: {
    progress: ?number,
  },
};

export type TaskErroredAction = {
  type: 'TASK_ERRORED',
  payload: {
    error: Error,
    task: ?Task,
  },
};

export type TaskStartedAction = {
  type: 'TASK_STARTED',
  payload: {
    task: Task,
  },
};

export type TaskStoppedAction = {
  type: 'TASK_STOPPED',
  payload: {
    task: Task,
  },
};

export type RegisterTaskRunnerAction = {
  type: 'REGISTER_TASK_RUNNER',
  payload: {
    taskRunner: TaskRunner,
  },
};

export type RunTaskAction = {
  type: 'RUN_TASK',
  payload: {
    taskId: ?TaskId,
  },
};

export type SetProjectRootAction = {
  type: 'SET_PROJECT_ROOT',
  payload: {
    projectRoot: ?Directory,
  },
};

export type SetToolbarVisibilityAction = {
  type: 'SET_TOOLBAR_VISIBILITY',
  payload: {
    visible: boolean,
  },
};

export type StopTaskAction = {
  type: 'STOP_TASK',
};

export type ToggleToolbarVisibilityAction = {
  type: 'TOGGLE_TOOLBAR_VISIBILITY',
  payload: {
    taskRunnerId: ?string,
  },
};

export type SetTaskListsAction = {
  type: 'SET_TASK_LISTS',
  payload: {
    taskLists: Map<string, Array<AnnotatedTaskMetadata>>,
  },
};

export type UnregisterTaskRunnerAction = {
  type: 'UNREGISTER_TASK_RUNNER',
  payload: {
    id: string,
  },
};

export type Action =
  DidLoadInitialPackagesAction
  | RunTaskAction
  | SelectTaskAction
  | SetProjectRootAction
  | SetTaskListsAction
  | SetToolbarVisibilityAction
  | StopTaskAction
  | TaskCompletedAction
  | TaskProgressAction
  | TaskErroredAction
  | TaskStartedAction
  | TaskStoppedAction
  | ToggleToolbarVisibilityAction
  | RegisterTaskRunnerAction
  | UnregisterTaskRunnerAction;

export type TaskRunnerServiceApi = {
  register(taskRunner: TaskRunner): IDisposable,
};
