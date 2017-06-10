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

import type {TaskEvent} from 'nuclide-commons/process';

import {Observable, ReplaySubject, Subscription} from 'rxjs';

export class DeviceTask {
  _name: string;
  _taskFactory: () => Observable<TaskEvent>;
  _subscription: ?Subscription = null;
  _events: ReplaySubject<?TaskEvent> = new ReplaySubject(1);

  constructor(taskFactory: () => Observable<TaskEvent>, name: string) {
    this._taskFactory = taskFactory;
    this._name = name;
    this._events.next(null);
  }

  getName(): string {
    return this._name;
  }

  getTaskEvents(): Observable<?TaskEvent> {
    return this._events;
  }

  start(): void {
    const task = this._taskFactory().share();
    this._subscription = task.subscribe(
      message => {
        this._events.next(message);
        if (message.type === 'result') {
          atom.notifications.addSuccess(
            `Device task '${this._name}' succeeded.`,
          );
        }
      },
      () => {
        atom.notifications.addError(`Device task '${this._name}' failed.`);
        this._finishRun();
      },
      () => {
        this._finishRun();
      },
    );
  }

  cancel(): void {
    this._finishRun();
  }

  _finishRun(): void {
    if (this._subscription != null) {
      this._subscription.unsubscribe();
      this._subscription = null;
    }
    this._events.next(null);
  }
}
