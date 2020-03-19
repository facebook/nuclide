/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {
  Action,
  TaskRunner,
  TaskRunnerState,
  TaskStatus,
  TaskOutcome,
} from '../types';
import textFromOutcomeAction from './textFromOutcomeAction';
import type {ConsoleApi, ConsoleService} from 'atom-ide-ui';

import * as Actions from './Actions';
import * as Immutable from 'immutable';

export function initialPackagesActivated(
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

export function readyTaskRunners(
  state: Immutable.Set<TaskRunner> = Immutable.Set(),
  action: Action,
): Immutable.Set<TaskRunner> {
  switch (action.type) {
    case Actions.SET_PROJECT_ROOT:
      return Immutable.Set();
    case Actions.SET_STATE_FOR_TASK_RUNNER:
      return state.add(action.payload.taskRunner);
    case Actions.SET_STATES_FOR_TASK_RUNNERS:
      return state.concat(action.payload.statesForTaskRunners.keys());
    case Actions.UNREGISTER_TASK_RUNNER:
      return state.remove(action.payload.taskRunner);
    default:
      return state;
  }
}

export function taskRunners(
  state: Immutable.List<TaskRunner> = Immutable.List(),
  action: Action,
): Immutable.List<TaskRunner> {
  switch (action.type) {
    case Actions.REGISTER_TASK_RUNNER: {
      const {taskRunner} = action.payload;
      return state
        .push(taskRunner)
        .sort((a, b) =>
          a.name.toUpperCase().localeCompare(b.name.toUpperCase()),
        );
    }
    case Actions.UNREGISTER_TASK_RUNNER: {
      const {taskRunner} = action.payload;
      return state.delete(state.indexOf(taskRunner));
    }
    default: {
      return state;
    }
  }
}

export function statesForTaskRunners(
  state: Immutable.Map<TaskRunner, TaskRunnerState> = Immutable.Map(),
  action: Action,
): Immutable.Map<TaskRunner, TaskRunnerState> {
  switch (action.type) {
    case Actions.SET_PROJECT_ROOT:
      return Immutable.Map();
    case Actions.UNREGISTER_TASK_RUNNER:
      return state.delete(action.payload.taskRunner);
    case Actions.SET_STATES_FOR_TASK_RUNNERS:
      return state.merge(action.payload.statesForTaskRunners);
    case Actions.SET_STATE_FOR_TASK_RUNNER:
      const {taskRunner, taskRunnerState} = action.payload;
      return state.set(taskRunner, taskRunnerState);
    default:
      return state;
  }
}

export function projectRoot(
  state: ?NuclideUri = null,
  action: Action,
): ?NuclideUri {
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
    case Actions.TASK_STATUS:
      return {...state, status: action.payload.status};
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

export function mostRecentTaskOutcome(
  state: ?TaskOutcome = null,
  action: Action,
): ?TaskOutcome {
  switch (action.type) {
    case Actions.TASK_COMPLETED:
      return {type: 'success', message: textFromOutcomeAction(action)};
    case Actions.TASK_ERRORED:
      return {type: 'error', message: textFromOutcomeAction(action)};
    case Actions.TASK_STOPPED:
      return {type: 'cancelled', message: textFromOutcomeAction(action)};
    case Actions.TASK_STARTED:
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
  state: Immutable.Map<TaskRunner, ConsoleApi> = Immutable.Map(),
  action: Action,
): Immutable.Map<TaskRunner, ConsoleApi> {
  switch (action.type) {
    case Actions.SET_CONSOLES_FOR_TASK_RUNNERS:
      state.forEach(value => value.dispose());
      return action.payload.consolesForTaskRunners;
    case Actions.ADD_CONSOLE_FOR_TASK_RUNNER:
      const {consoleApi, taskRunner} = action.payload;
      return state.set(taskRunner, consoleApi);
    case Actions.REMOVE_CONSOLE_FOR_TASK_RUNNER:
      const previous = state.get(action.payload.taskRunner);
      if (previous) {
        previous.dispose();
      }
      return state.delete(action.payload.taskRunner);
    case Actions.SET_CONSOLE_SERVICE:
      state.forEach(value => value.dispose());
      return Immutable.Map();
    default:
      return state;
  }
}
