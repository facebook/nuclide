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

import type {LocalStorageJsonTable} from '../../commons-atom/LocalStorageJsonTable';
import type {IconName} from 'nuclide-commons-ui/Icon';
import type {Task} from '../../commons-node/tasks';
import type {Message} from 'nuclide-commons/process';
import type {Directory} from '../../nuclide-remote-connection';
import type {ConsoleApi, ConsoleService} from '../../nuclide-console/lib/types';

export type AppState = {
  taskRunnersReady: boolean,
  isUpdatingTaskRunners: boolean,
  projectRoot: ?Directory,

  visible: boolean,

  // selected task runner, won't be null as long as there's at least one runner enabled
  activeTaskRunner: ?TaskRunner,
  taskRunners: Array<TaskRunner>,
  statesForTaskRunners: Map<TaskRunner, TaskRunnerState>,

  runningTask: ?TaskStatus,

  consoleService: ?ConsoleService,
  consolesForTaskRunners: Map<TaskRunner, ConsoleApi>,
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

export type TaskStatus = {
  metadata: TaskMetadata,
  task: Task,
  progress: ?number,
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

export type TaskRunner = {
  id: string,
  name: string,
  +getExtraUi?: () => ReactClass<any>,
  +getIcon: () => ReactClass<any>,
  +runTask: (taskType: string) => Task,
  // Returns a callback that executes when the task runner determines whether it should be enabled
  // or when the task list changes for the project root
  +setProjectRoot: (
    projectRoot: ?Directory,
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
};

export type BoundActionCreators = {
  registerTaskRunner(taskRunner: TaskRunner): void,
  runTask(taskId: TaskMetadata): void,
  setProjectRoot(dir: ?Directory): void,
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
    statesForTaskRunners: Map<TaskRunner, TaskRunnerState>,
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
    taskMeta: TaskMetadata & {taskRunner: TaskRunner},
    verifySaved: boolean,
  },
};

export type SetProjectRootAction = {
  type: 'SET_PROJECT_ROOT',
  payload: {
    projectRoot: ?Directory,
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
    consolesForTaskRunners: Map<TaskRunner, ConsoleApi>,
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
  | TaskMessageAction
  | TaskErroredAction
  | TaskStartedAction
  | TaskStoppedAction
  | ToggleToolbarVisibilityAction
  | RegisterTaskRunnerAction
  | UnregisterTaskRunnerAction;

export type TaskRunnerServiceApi = {
  register(taskRunner: TaskRunner): IDisposable,
};
