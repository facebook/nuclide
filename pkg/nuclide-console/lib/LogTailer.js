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

import type {Message, OutputProviderStatus} from './types';
import type {ConnectableObservable} from 'rxjs';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {track} from '../../nuclide-analytics';
import {getLogger} from 'log4js';
import {BehaviorSubject, Observable, Subscription} from 'rxjs';

type TrackingEventNames = {
  start: string,
  stop: string,
  restart: string,
};

type Options = {
  name: string,
  messages: Observable<Message>,
  trackingEvents: TrackingEventNames,

  // Signals that the source is ready ("running"). This allows us to account for sources that need
  // some initialization without having to worry about it in cases that don't.
  ready?: Observable<void>,

  // An optional error handler. Passing a handler to this class instead of catching errors in the
  // observable allows us to centralize some error handling (logging and default notifications). If
  // the user doesn't wish to handle a particular error, it should be re-thrown by the errorHandler.
  handleError?: (err: Error) => void,
};

type StartOptions = {
  // A node-style error-first callback. This API is used because: Atom commands don't let us return
  // values (an Observable or Promise would work well here) and we want to have success and error
  // messages use the same channel (instead of a separate `onRunning` and `onRunningError`
  // callback).
  onRunning: (err?: Error) => mixed,
};

/**
 * A utility for writing packages that tail log sources. Just give it a cold observable and let it
 * handle the rest.
 *
 * This class:
 *   1. Provides an imperative interface to the underlying observable. (`start()`, `stop()`)
 *   2. Manages subscriptions to treat the process like a singleton.
 *   3. Exposes a way of observing the status of the process.
 *   4. Provides centralized (and fallback) error handling for errors that occur during the
 *      "startup" phase (before the process has signalled that it's ready), and afterwards.
 */
export class LogTailer {
  _name: string;
  _eventNames: TrackingEventNames;
  _subscription: ?rxjs$ISubscription;
  _messages: ConnectableObservable<Message>;
  _ready: ?Observable<void>;
  _runningCallbacks: Array<(err?: Error) => mixed>;
  _errorHandler: ?(err: Error) => void;
  _startCount: number;
  _statuses: BehaviorSubject<OutputProviderStatus>;

  constructor(options: Options) {
    this._name = options.name;
    this._eventNames = options.trackingEvents;
    this._errorHandler = options.handleError;
    const messages = options.messages.share();
    this._ready = options.ready == null
      ? null
      : // Guard against a never-ending ready stream.
        // $FlowFixMe: Add `materialize()` to Rx defs
        options.ready.takeUntil(messages.materialize().takeLast(1));
    this._runningCallbacks = [];
    this._startCount = 0;
    this._statuses = new BehaviorSubject('stopped');

    this._messages = Observable.merge(
      messages,
      this._ready == null ? Observable.empty() : this._ready.ignoreElements(), // For the errors.
    )
      .do({
        complete: () => {
          // If the process completed without ever entering the "running" state, invoke the
          // `onRunning` callback with a cancellation error.
          this._invokeRunningCallbacks(new ProcessCancelledError(this._name));
          this._stop();
        },
      })
      .catch(err => {
        getLogger('nuclide-console').error(
          `Error with ${this._name} tailer.`,
          err,
        );
        const wasStarting = this._statuses.getValue() === 'starting';
        this._stop(false);

        let errorWasHandled = wasStarting && !this._invokeRunningCallbacks(err);

        // Give the LogTailer instance a chance to handle it.
        if (!errorWasHandled && this._errorHandler != null) {
          try {
            this._errorHandler(err);
            errorWasHandled = true;
          } catch (errorHandlerError) {
            if (err !== errorHandlerError) {
              // Uh oh. Another error was raised while handling this one!
              throw errorHandlerError;
            }
          }
        }

        if (!errorWasHandled) {
          // Default error handling.
          const message =
            `An unexpected error occurred while running the ${this._name} process` +
            (err.message ? `:\n\n**${err.message}**` : '.');
          const notification = atom.notifications.addError(message, {
            dismissable: true,
            detail: err.stack == null ? '' : err.stack.toString(),
            buttons: [
              {
                text: `Restart ${this._name}`,
                className: 'icon icon-sync',
                onDidClick: () => {
                  notification.dismiss();
                  this.restart();
                },
              },
            ],
          });
        }

        return Observable.empty();
      })
      .share()
      .publish();

    // Whenever the status becomes "running," invoke all of the registered running callbacks.
    this._statuses
      .distinctUntilChanged()
      .filter(status => status === 'running')
      .subscribe(() => {
        this._invokeRunningCallbacks();
      });
  }

  start(options?: StartOptions): void {
    this._startCount += 1;
    if (options != null && options.onRunning != null) {
      this._runningCallbacks.push(options.onRunning);
    }
    this._start(true);
  }

  stop(): void {
    // If the process is explicitly stopped, call all of the running callbacks with a cancelation
    // error.
    this._startCount = 0;
    this._runningCallbacks.forEach(cb => {
      cb(new ProcessCancelledError(this._name));
    });

    this._stop();
  }

  restart(): void {
    track(this._eventNames.restart);
    this._stop(false);
    this._start(false);
  }

  observeStatus(
    cb: (status: 'starting' | 'running' | 'stopped') => void,
  ): IDisposable {
    return new UniversalDisposable(this._statuses.subscribe(cb));
  }

  /**
   * Invoke the running callbacks. Returns true if the error wasn't handled; otherwise false.
   */
  _invokeRunningCallbacks(err: ?Error): boolean {
    // Invoke all of the registered running callbacks.
    if (this._runningCallbacks.length > 0) {
      this._runningCallbacks.forEach(cb => {
        if (err == null) {
          cb();
        } else {
          cb(err);
        }
      });
    }

    const unhandledError =
      err != null && this._startCount !== this._runningCallbacks.length;
    this._runningCallbacks = [];
    this._startCount = 0;
    return unhandledError;
  }

  _start(trackCall: boolean): void {
    atom.commands.dispatch(
      atom.views.getView(atom.workspace),
      'nuclide-console:toggle',
      {visible: true},
    );

    const currentStatus = this._statuses.getValue();
    if (currentStatus === 'starting') {
      return;
    } else if (currentStatus === 'running') {
      this._invokeRunningCallbacks();
      return;
    }

    if (trackCall) {
      track(this._eventNames.start);
    }

    // If the LogTailer was created with a way of detecting when the source was ready, the initial
    // status is "starting." Otherwise, assume that it's started immediately.
    const initialStatus = this._ready == null ? 'running' : 'starting';
    this._statuses.next(initialStatus);

    if (this._subscription != null) {
      this._subscription.unsubscribe();
    }

    const sub = new Subscription();
    if (this._ready != null) {
      sub.add(
        this._ready
          // Ignore errors here. We'll catch them above.
          .catch(error => Observable.empty())
          .takeUntil(this._statuses.filter(status => status !== 'starting'))
          .subscribe(() => {
            this._statuses.next('running');
          }),
      );
    }
    sub.add(this._messages.connect());
    this._subscription = sub;
  }

  _stop(trackCall: boolean = true): void {
    if (this._subscription != null) {
      this._subscription.unsubscribe();
    }

    if (this._statuses.getValue() === 'stopped') {
      return;
    }
    if (trackCall) {
      track(this._eventNames.stop);
    }

    this._statuses.next('stopped');
  }

  getMessages(): Observable<Message> {
    return this._messages;
  }
}

class ProcessCancelledError extends Error {
  constructor(logProducerName: string) {
    super(`${logProducerName} was stopped`);
    this.name = 'ProcessCancelledError';
  }
}
