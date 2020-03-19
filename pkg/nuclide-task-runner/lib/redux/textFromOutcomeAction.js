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

import type {Action} from '../types';
import invariant from 'assert';
import * as Actions from './Actions';

export default function textFromOutcomeAction(action: Action): string {
  invariant(
    action.type === Actions.TASK_STOPPED ||
      action.type === Actions.TASK_COMPLETED ||
      action.type === Actions.TASK_ERRORED,
  );
  const {type, label} = action.payload.taskStatus.metadata;
  switch (action.type) {
    case Actions.TASK_STOPPED:
      const capitalizedType = type.slice(0, 1).toUpperCase() + type.slice(1);
      return `${capitalizedType} cancelled.`;
    case Actions.TASK_COMPLETED:
      if (
        type !== 'build-launch-debug' &&
        type !== 'launch-debug' &&
        type !== 'attach-debug'
      ) {
        return label + ' succeeded.';
      } else {
        // "Debug succeeded." makes no sense here.
        return 'Debugger started.';
      }
    case Actions.TASK_ERRORED:
      return `The task "${label}" failed.`;
    default:
      throw new Error(
        'Unexpected action in textFromOutcomeAction: ' + action.type,
      );
  }
}
