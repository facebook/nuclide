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

import type {Action, TaskRunner, TaskRunnerState, TaskStatus} from '../types';
import type {Directory} from '../../../nuclide-remote-connection';
import type {
  ConsoleApi,
  ConsoleService,
} from '../../../nuclide-console/lib/types';

import * as Actions from './Actions';

export function taskRunnersReady(
  state: boolean = false,
  action: Action,
): boolean {
  switch (action.type) {
    case Actions.DID_ACTIVATE_INITIAL_PACKAGES:
      return true;
    default:
      return state;
  }
}

export function isUpdatingTaskRunners(
  state: boolean = true,
  action: Action,
): boolean {
  switch (action.type) {
    case Actions.SET_PROJECT_ROOT:
      return true;
    case Actions.SET_STATES_FOR_TASK_RUNNERS:
      return false;
    default:
      return state;
  }
}

export function taskRunners(
  state: Array<TaskRunner> = [],
  action: Action,
): Array<TaskRunner> {
  switch (action.type) {
    case Actions.REGISTER_TASK_RUNNER: {
      const {taskRunner} = action.payload;
      return state
        .concat(taskRunner)
        .sort((a, b) =>
          a.name.toUpperCase().localeCompare(b.name.toUpperCase()),
        );
    }
    case Actions.UNREGISTER_TASK_RUNNER: {
      const {taskRunner} = action.payload;
      return state.slice().filter(element => element !== taskRunner);
    }
    default: {
      return state;
    }
  }
}

export function statesForTaskRunners(
  state: Map<TaskRunner, TaskRunnerState> = new Map(),
  action: Action,
): Map<TaskRunner, TaskRunnerState> {
  switch (action.type) {
    case Actions.SET_PROJECT_ROOT:
      return new Map();
    case Actions.UNREGISTER_TASK_RUNNER:
      const newMap = new Map(state.entries());
      newMap.delete(action.payload.taskRunner);
      return newMap;
    case Actions.SET_STATES_FOR_TASK_RUNNERS:
      return new Map([
        ...state.entries(),
        ...action.payload.statesForTaskRunners.entries(),
      ]);
    case Actions.SET_STATE_FOR_TASK_RUNNER:
      const {taskRunner, taskRunnerState} = action.payload;
      return new Map(state.entries()).set(taskRunner, taskRunnerState);
    default:
      return state;
  }
}

export function projectRoot(
  state: ?Directory = null,
  action: Action,
): ?Directory {
  switch (action.type) {
    case Actions.SET_PROJECT_ROOT:
      return action.payload.projectRoot;
    default:
      return state;
  }
}

export function visible(state: boolean = false, action: Action): boolean {
  switch (action.type) {
    case Actions.SET_TOOLBAR_VISIBILITY:
      return action.payload.visible;
    default:
      return state;
  }
}

export function activeTaskRunner(
  state: ?TaskRunner = null,
  action: Action,
): ?TaskRunner {
  switch (action.type) {
    case Actions.SELECT_TASK_RUNNER:
      return action.payload.taskRunner;
    case Actions.SET_PROJECT_ROOT:
      return null;
    default:
      return state;
  }
}

export function runningTask(
  state: ?TaskStatus = null,
  action: Action,
): ?TaskStatus {
  switch (action.type) {
    case Actions.TASK_COMPLETED:
      return null;
    case Actions.TASK_PROGRESS:
      return {...state, progress: action.payload.progress};
    case Actions.TASK_ERRORED:
      return null;
    case Actions.TASK_STARTED:
      return action.payload.taskStatus;
    case Actions.TASK_STOPPED:
      return null;
    default:
      return state;
  }
}

export function consoleService(
  state: ?ConsoleService = null,
  action: Action,
): ?ConsoleService {
  switch (action.type) {
    case Actions.SET_CONSOLE_SERVICE:
      return action.payload.service;
    default:
      return state;
  }
}

export function consolesForTaskRunners(
  state: Map<TaskRunner, ConsoleApi> = new Map(),
  action: Action,
): Map<TaskRunner, ConsoleApi> {
  switch (action.type) {
    case Actions.SET_CONSOLES_FOR_TASK_RUNNERS:
      state.forEach((value, key) => {
        value.dispose();
      });
      return action.payload.consolesForTaskRunners;
    case Actions.SET_CONSOLE_SERVICE:
      return new Map();
    case Actions.ADD_CONSOLE_FOR_TASK_RUNNER:
      const {consoleApi, taskRunner} = action.payload;
      return new Map(state.entries()).set(taskRunner, consoleApi);
    case Actions.REMOVE_CONSOLE_FOR_TASK_RUNNER:
      const previous = state.get(action.payload.taskRunner);
      const newState = new Map(state.entries());
      if (previous) {
        previous.dispose();
        newState.delete(action.payload.taskRunner);
      }
      return newState;
    default:
      return state;
  }
}
