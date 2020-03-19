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

import type {Task} from '../../commons-node/tasks';

import {taskFromObservable} from '../../commons-node/tasks';
import {Observable} from 'rxjs';

export default function createExampleObservableTask(): Task {
  const messageEvents = Observable.interval(3000).map(() => ({
    type: 'message',
    message: {
      level: 'info',
      text: `It is currently ${new Date().toString()}`,
    },
  }));

  const progressEvents = Observable.interval(1000).map(x => ({
    type: 'progress',
    progress: x * 0.05,
  }));

  const allEvents = Observable.merge(messageEvents, progressEvents);
  const complete = Observable.timer(15000);
  return taskFromObservable(allEvents.takeUntil(complete));
}
