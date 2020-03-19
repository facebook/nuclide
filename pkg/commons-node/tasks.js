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

// It's really convenient to model processes with Observables but Atom use a more OO [Task
// interface](https://atom.io/docs/api/latest/Task). These are utilities for converting between the
// two.

import type {TaskEvent, Message, Level, Status} from 'nuclide-commons/process';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import invariant from 'assert';
import {Observable, Subscription} from 'rxjs';

// FIXME: This should really be an interface, but we're currently transpiling with Babel 5, which
//   doesn't support that.
export type Task = {
  start: () => void,
  cancel: () => void,
  onDidComplete: (callback: () => mixed) => IDisposable,
  onDidError: (callback: (err: Error) => mixed) => IDisposable,
  +onMessage?: (callback: (message: Message) => mixed) => IDisposable,
  +onProgress?: (callback: (progress: ?number) => mixed) => IDisposable,
  +onResult?: (callback: (result: mixed) => mixed) => IDisposable,
  +onStatusChange?: (callback: (status: ?Status) => mixed) => IDisposable,
};

/**
 * Subscribe to an observable and transform it into the Task interface. The Task interface allows us
 * to interop nicely with Atom and Atom packages without forcing them to use Rx, but internally,
 * Observables are probably how we'll always build the functionality.
 */
export function taskFromObservable(observable: Observable<TaskEvent>): Task {
  const events = observable.share().publish();
  let subscription;

  const task = {
    start(): void {
      if (subscription == null) {
        subscription = events.connect();
      }
    },
    cancel(): void {
      if (subscription != null) {
        subscription.unsubscribe();
      }
    },
    onDidComplete(callback: () => mixed): IDisposable {
      return new UniversalDisposable(
        events.subscribe({complete: callback, error: () => {}}),
      );
    },
    onDidError(callback: (err: Error) => mixed): IDisposable {
      return new UniversalDisposable(events.subscribe({error: callback}));
    },
    onMessage(callback: (message: Message) => mixed): IDisposable {
      return new UniversalDisposable(
        events
          .filter(event => event.type === 'message')
          .map(event => {
            invariant(event.type === 'message');
            return event.message;
          })
          .subscribe({next: callback, error: () => {}}),
      );
    },
    onProgress(callback: (progress: ?number) => mixed): IDisposable {
      return new UniversalDisposable(
        events
          .filter(event => event.type === 'progress')
          .map(event => {
            invariant(event.type === 'progress');
            return event.progress;
          })
          .subscribe({next: callback, error: () => {}}),
      );
    },
    onResult(callback: (result: mixed) => mixed): IDisposable {
      return new UniversalDisposable(
        events
          .filter(event => event.type === 'result')
          .map(event => {
            invariant(event.type === 'result');
            return event.result;
          })
          .subscribe({next: callback, error: () => {}}),
      );
    },
    onStatusChange(callback: (status: ?Status) => mixed): IDisposable {
      return new UniversalDisposable(
        events
          .filter(event => event.type === 'status')
          .map(event => {
            invariant(event.type === 'status');
            return event.status;
          })
          .subscribe({next: callback, error: () => {}}),
      );
    },
  };
  return task;
}

/**
 * Convert a task to an observable of events.
 */
export function observableFromTask(task: Task): Observable<TaskEvent> {
  return Observable.create(observer => {
    let finished = false;

    const messages =
      typeof task.onMessage === 'function'
        ? observableFromSubscribeFunction(task.onMessage.bind(task)).map(
            message => ({type: 'message', message}),
          )
        : Observable.never();
    const progresses =
      typeof task.onProgress === 'function'
        ? observableFromSubscribeFunction(task.onProgress.bind(task)).map(
            progress => ({type: 'progress', progress}),
          )
        : Observable.never();
    const results =
      typeof task.onResult === 'function'
        ? observableFromSubscribeFunction(task.onResult.bind(task)).map(
            result => ({type: 'result', result}),
          )
        : Observable.never();
    const statuses =
      typeof task.onStatusChange === 'function'
        ? observableFromSubscribeFunction(task.onStatusChange.bind(task)).map(
            status => ({type: 'status', status}),
          )
        : Observable.never();

    const completeEvents = observableFromSubscribeFunction(
      task.onDidComplete.bind(task),
    );
    const errors = observableFromSubscribeFunction(
      task.onDidError.bind(task),
    ).switchMap(Observable.throw);

    const subscription = new Subscription();

    subscription.add(() => {
      if (!finished) {
        task.cancel();
      }
    });

    subscription.add(
      Observable.merge(messages, progresses, results, statuses, errors)
        .takeUntil(completeEvents)
        .do({
          complete: () => {
            finished = true;
          },
          error: () => {
            finished = true;
          },
        })
        .subscribe(observer),
    );

    task.start();

    return subscription;
  });
}

export function createMessage(
  text: string,
  level: Level,
): Observable<TaskEvent> {
  return Observable.of({
    type: 'message',
    message: {text, level},
  });
}

export function createResult(result: mixed): Observable<TaskEvent> {
  return Observable.of({
    type: 'result',
    result,
  });
}

export function createStatus(
  type: string,
  object: mixed,
): Observable<TaskEvent> {
  return Observable.of({
    type: 'status',
    status: {type, object},
  });
}

export function createProgress(progress: ?number): Observable<TaskEvent> {
  return Observable.of({
    type: 'progress',
    progress,
  });
}

export function createStep(
  stepName: ?string,
  action: () => Observable<TaskEvent> | Promise<TaskEvent>,
): Observable<TaskEvent> {
  return Observable.concat(
    Observable.of({type: 'progress', progress: null}),
    Boolean(stepName)
      ? Observable.of({
          type: 'status',
          status: {
            type: 'string',
            object: stepName,
          },
        })
      : Observable.empty(),
    Observable.defer(action),
  );
}
