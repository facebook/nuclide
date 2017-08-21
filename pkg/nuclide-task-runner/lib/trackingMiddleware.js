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
  Store,
  TaskStartedAction,
  TaskStoppedAction,
  TaskCompletedAction,
  TaskErroredAction,
} from './types';

import * as Actions from './redux/Actions';
import {trackEvent} from '../../nuclide-analytics';
import invariant from 'assert';

export function trackingMiddleware(
  store: Store,
): ((action: Action) => Store) => (action: Action) => Store {
  return next => action => {
    switch (action.type) {
      case Actions.TASK_STARTED:
        trackTaskAction('nuclide-task-runner:task-started', store, action);
        break;
      case Actions.TASK_STOPPED:
        trackTaskAction('nuclide-task-runner:task-stopped', store, action);
        break;
      case Actions.TASK_COMPLETED:
        trackTaskAction('nuclide-task-runner:task-completed', store, action);
        break;
      case Actions.TASK_ERRORED:
        trackTaskAction('nuclide-task-runner:task-errored', store, action);
        break;
    }
    return next(action);
  };
}

function trackTaskAction(
  type: string,
  store: Store,
  action:
    | TaskStartedAction
    | TaskStoppedAction
    | TaskCompletedAction
    | TaskErroredAction,
): void {
  const {activeTaskRunner} = store.getState();
  invariant(activeTaskRunner);
  const {taskStatus} = action.payload;
  const {task} = taskStatus;
  const taskTrackingData =
    typeof task.getTrackingData === 'function' ? task.getTrackingData() : {};
  const error =
    action.type === Actions.TASK_ERRORED ? action.payload.error : null;
  trackEvent({
    type,
    data: {
      ...taskTrackingData,
      taskRunnerId: activeTaskRunner.id,
      taskType: taskStatus.metadata.type,
      errorMessage: error != null ? error.message : null,
      stackTrace: error != null ? String(error.stack) : null,
    },
  });
}
