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
import type {LocalStorageJsonTable} from '../../commons-atom/LocalStorageJsonTable';
import type {IconName} from 'nuclide-commons-ui/Icon';
import type {Task} from '../../commons-node/tasks';
import type {Message, Status} from 'nuclide-commons/process';
import type {ConsoleApi, ConsoleService} from 'atom-ide-ui';
import * as React from 'react';
import * as Immutable from 'immutable';

export type AppState = {
  initialPackagesActivated: boolean,
  readyTaskRunners: Immutable.Set<TaskRunner>,
  projectRoot: ?NuclideUri,

  visible: boolean,

  // selected task runner, won't be null as long as there's at least one runner enabled
  activeTaskRunner: ?TaskRunner,
  taskRunners: Immutable.List<TaskRunner>,
  statesForTaskRunners: Immutable.Map<TaskRunner, TaskRunnerState>,

  runningTask: ?TaskStatus,

  mostRecentTaskOutcome: ?TaskOutcome,

  consoleService: ?ConsoleService,
  consolesForTaskRunners: Immutable.Map<TaskRunner, ConsoleApi>,
};

export type TaskOutcome = {
  type: 'success' | 'cancelled' | 'error',
  message: string,
};

export type ToolbarStatePreference = {
  taskRunnerId: ?string,
  visible: boolean,
};

export type EpicOptions = {
  preferencesForWorkingRoots: LocalStorageJsonTable<?ToolbarStatePreference>,
};

export type SerializedAppState = {
  previousSessionVisible: ?boolean,
  version?: number,
};

export type TaskRunnerBulletinTitle = {
  message: string,
  level?: 'log' | 'success' | 'warning' | 'error',
};

export type TaskRunnerBulletinStatus = {
  title: TaskRunnerBulletinTitle,
  detail: React.Element<any>,
};

export type TaskRunnerBulletinStatusEvent = {
  type: 'bulletin',
  status: TaskRunnerBulletinStatus,
};

export type TaskStatus = {
  metadata: TaskMetadata,
  task: Task,
  progress: ?number,
  status: ?Status,
  startDate: Date,
};

export type TaskMetadata = {
  type: string,
  label: string,
  description: string,
  icon: IconName,
  disabled?: boolean,
  cancelable?: boolean, // By default, this is true (all tasks are cancelable).
  // If you define a task as hidden, it won't render its button. It'll still create an atom command
  // and you're responsible giving the user an alternative way to trigger it. You still get
  // the benefits of tracking progress etc.
  hidden?: boolean, // By default, this is false
};

export type TaskOptions = {
  [string]: mixed,
};

export type TaskRunner = {
  id: string,
  name: string,
  +getExtraUi?: () => React$ComponentType<any>,
  +getIcon: () => React$ComponentType<any>,
  +runTask: (taskType: string, options: ?TaskOptions) => Task,
  // Returns a callback that executes when the task runner determines whether it should be enabled
  // or when the task list changes for the project root
  +setProjectRoot: (
    projectRoot: ?NuclideUri,
    callback: (enabled: boolean, taskList: Array<TaskMetadata>) => mixed,
  ) => IDisposable,
  // Priority to decide which task runner to select when multiple are available for a project
  // Default priority is 0, ties are resolved alphabetically.
  +getPriority?: () => number,
};

export type TaskRunnerState = {
  enabled: boolean,
  tasks: Array<TaskMetadata>,
};

export type Store = {
  getState(): AppState,
  dispatch(action: Action): void,
  subscribe(listener: () => void): () => void,
  replaceReducer(reducer: () => mixed): void,
};

export type BoundActionCreators = {
  registerTaskRunner(taskRunner: TaskRunner): void,
  runTask(
    taskRunner: TaskRunner,
    taskId: TaskMetadata,
    options: ?TaskOptions,
  ): void,
  setProjectRoot(dir: ?NuclideUri): void,
  setConsoleService(service: ?ConsoleService): void,
  setToolbarVisibility(visible: boolean): void,
  stopTask(): void,
  requestToggleToolbarVisibility(
    visible: ?boolean,
    taskRunner: ?TaskRunner,
  ): void,
  unregisterTaskRunner(taskRunner: TaskRunner): void,
};

//
// Action types.
//

export type DidActivateInitialPackagesAction = {
  type: 'DID_ACTIVATE_INITIAL_PACKAGES',
};

export type SelectTaskRunnerAction = {
  type: 'SELECT_TASK_RUNNER',
  payload: {
    taskRunner: ?TaskRunner,
    updateUserPreferences: boolean,
  },
};

export type SetStateForTaskRunnerAction = {
  type: 'SET_STATE_FOR_TASK_RUNNER',
  payload: {
    taskRunner: TaskRunner,
    taskRunnerState: TaskRunnerState,
  },
};

export type SetStatesForTaskRunnersAction = {
  type: 'SET_STATES_FOR_TASK_RUNNERS',
  payload: {
    statesForTaskRunners: Immutable.Map<TaskRunner, TaskRunnerState>,
  },
};

export type TaskCompletedAction = {
  type: 'TASK_COMPLETED',
  payload: {
    taskStatus: TaskStatus,
    taskRunner: TaskRunner,
  },
};

type TaskProgressAction = {
  type: 'TASK_PROGRESS',
  payload: {
    progress: ?number,
  },
};

type TaskStatusAction = {
  type: 'TASK_STATUS',
  payload: {
    status: ?Status,
  },
};

type TaskMessageAction = {
  type: 'TASK_MESSAGE',
  payload: {
    message: Message,
    taskRunner: TaskRunner,
  },
};

export type TaskErroredAction = {
  type: 'TASK_ERRORED',
  payload: {
    error: Error,
    taskRunner: TaskRunner,
    taskStatus: TaskStatus,
  },
};

export type TaskStartedAction = {
  type: 'TASK_STARTED',
  payload: {
    taskStatus: TaskStatus,
  },
};

export type TaskStoppedAction = {
  type: 'TASK_STOPPED',
  payload: {
    taskStatus: TaskStatus,
    taskRunner: TaskRunner,
  },
};

export type RegisterTaskRunnerAction = {
  type: 'REGISTER_TASK_RUNNER',
  payload: {
    taskRunner: TaskRunner,
  },
};

export type UnregisterTaskRunnerAction = {
  type: 'UNREGISTER_TASK_RUNNER',
  payload: {
    taskRunner: TaskRunner,
  },
};

export type RunTaskAction = {
  type: 'RUN_TASK',
  payload: {
    taskMeta: TaskMetadata,
    taskRunner: TaskRunner,
    options: ?TaskOptions,
    verifySaved: boolean,
  },
};

export type SetProjectRootAction = {
  type: 'SET_PROJECT_ROOT',
  payload: {
    projectRoot: ?NuclideUri,
  },
};

export type SetConsoleServiceAction = {
  type: 'SET_CONSOLE_SERVICE',
  payload: {
    service: ?ConsoleService,
  },
};

export type SetConsolesForTaskRunnersAction = {
  type: 'SET_CONSOLES_FOR_TASK_RUNNERS',
  payload: {
    consolesForTaskRunners: Immutable.Map<TaskRunner, ConsoleApi>,
  },
};

export type AddConsoleForTaskRunnerAction = {
  type: 'ADD_CONSOLE_FOR_TASK_RUNNER',
  payload: {
    taskRunner: TaskRunner,
    consoleApi: ConsoleApi,
  },
};

export type RemoveConsoleForTaskRunnerAction = {
  type: 'REMOVE_CONSOLE_FOR_TASK_RUNNER',
  payload: {
    taskRunner: TaskRunner,
  },
};

export type RequestToggleToolbarVisibilityAction = {
  type: 'REQUEST_TOGGLE_TOOLBAR_VISIBILITY',
  payload: {
    visible: ?boolean,
    taskRunner: ?TaskRunner,
  },
};

export type SetToolbarVisibilityAction = {
  type: 'SET_TOOLBAR_VISIBILITY',
  payload: {
    visible: boolean,
    updateUserPreferences: boolean,
  },
};

export type StopTaskAction = {
  type: 'STOP_TASK',
};

export type ToggleToolbarVisibilityAction = {
  type: 'TOGGLE_TOOLBAR_VISIBILITY',
  payload: {
    visible: ?boolean,
    taskRunner: ?TaskRunner,
  },
};

export type Action =
  | DidActivateInitialPackagesAction
  | RequestToggleToolbarVisibilityAction
  | RunTaskAction
  | SelectTaskRunnerAction
  | SetStatesForTaskRunnersAction
  | SetStateForTaskRunnerAction
  | SetProjectRootAction
  | SetConsoleServiceAction
  | SetConsolesForTaskRunnersAction
  | AddConsoleForTaskRunnerAction
  | RemoveConsoleForTaskRunnerAction
  | SetToolbarVisibilityAction
  | StopTaskAction
  | TaskCompletedAction
  | TaskProgressAction
  | TaskStatusAction
  | TaskMessageAction
  | TaskErroredAction
  | TaskStartedAction
  | TaskStoppedAction
  | ToggleToolbarVisibilityAction
  | RegisterTaskRunnerAction
  | UnregisterTaskRunnerAction;

export type TaskRunnerServiceApi = {
  register(taskRunner: TaskRunner): IDisposable,
  printToConsole(message: Message, taskRunner: TaskRunner): void,
};
