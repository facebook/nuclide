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

import type {ShowNotificationLevel, Progress, HostServices} from './rpc-types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {TextEdit} from 'nuclide-commons-atom/text-edit';

import invariant from 'assert';
import {Subject, ConnectableObservable} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

// This is how we declare in Flow that a type fulfills an interface.
(((null: any): HostServicesAggregator): HostServices);
(((null: any): HostServicesRelay): HostServices);

export async function forkHostServices(
  host: HostServices,
  logger: log4js$Logger,
): Promise<HostServices> {
  const child = new HostServicesAggregator();
  const howChildShouldRelayBackToHost = await host.childRegister(child);
  child.initialize(howChildShouldRelayBackToHost, logger);
  return child;

  // Here's an example tree of forked aggregators, with a vertical line to show
  // client-side objects on the left and server-side objects on the right.
  //
  // root            |
  //   <-> relayR0   |
  //   <-> relayR1 <-|-> aggregator
  //                 |    <-> relayA0
  //                 |    <-> relayA1 <-> child1
  //                 |    <-> relayA2 <-> child2
  //
  // If you call child1.consoleNotification(), it forwards to relayA1, which
  // forwards it on to relayR1. The buck stops at the root which is responsible
  // for displaying it.
  //
  // We also offer the same HostServices API on aggregator itself.
  // If you call aggregator.consoleNotification() it just dispatches to relayA0,
  // which behaves identically to relayA1 above. (We use relayA0 here, rather
  // than handling the call inside aggregator itself, to avoid code duplication)
  //
  // If you dispose child1, it relays news of its disposal via relayA1, which
  // removes it from aggregator's list of children.
  //
  // If you dispose aggregator, it disposes all of its remaining children, and
  // relays news of its disposal via relayR1, which removes it from root's
  // list of children.
  //
  // The call to 'root.childRegister(aggregator)' is what creates relayR1.
  // This call might be across nuclide-rpc, which is why childRegister has to
  // return a promise.
  //
  // Why do we use relays? so that each child can relay messages to its parent
  // aggregator, and so the parent aggregator can know which child that message
  // was relayed from, and so we can do all this without lots of duplicate
  // methods in the HostServices interface.
}

class HostServicesAggregator {
  _parent: HostServices;
  _childRelays: Map<number, HostServicesRelay> = new Map();
  _counter: number = 0;
  _logger: log4js$Logger;

  initialize(parent: HostServices, logger: log4js$Logger): void {
    this._parent = parent;
    this._logger = logger;
    const relay = new HostServicesRelay(this, 0, null);
    this._childRelays.set(0, relay);
  }

  _selfRelay(): HostServicesRelay {
    const relay = this._childRelays.get(0);
    invariant(relay != null);
    return relay;
  }

  consoleNotification(
    source: string,
    level: ShowNotificationLevel,
    text: string,
  ): void {
    this._selfRelay().consoleNotification(source, level, text);
  }

  dialogNotification(
    level: ShowNotificationLevel,
    text: string,
  ): ConnectableObservable<void> {
    return this._selfRelay().dialogNotification(level, text);
  }

  applyTextEditsForMultipleFiles(
    changes: Map<NuclideUri, Array<TextEdit>>,
  ): Promise<boolean> {
    return this._selfRelay().applyTextEditsForMultipleFiles(changes);
  }

  dialogRequest(
    level: ShowNotificationLevel,
    text: string,
    buttonLabels: Array<string>,
    closeLabel: string,
  ): ConnectableObservable<string> {
    return this._selfRelay().dialogRequest(
      level,
      text,
      buttonLabels,
      closeLabel,
    );
  }

  showProgress(
    title: string,
    options?: {|debounce?: boolean|},
  ): Promise<Progress> {
    return this._selfRelay().showProgress(title, options);
  }

  showActionRequired(
    title: string,
    options?: {|clickable?: boolean|},
  ): ConnectableObservable<void> {
    return this._selfRelay().showActionRequired(title, options);
  }

  // Call 'dispose' to dispose of the aggregate and all its children
  dispose(): void {
    // We'll explicitly dispose of everything that our own self relay keeps
    // track of (e.g. outstanding busy signals, notifications, ...)
    this._selfRelay()._disposables.dispose();

    // Next, for every child aggregate, tell it to dispose itself too.
    // The relay.child will notify the relay that it has been disposed, and
    // that's when the relay will do any further cleanup.
    // Note: _selfRelay is the only member of _childRelays that lacks _child.
    for (const relay of this._childRelays.values()) {
      if (relay._child != null) {
        relay._child.dispose();
      }
    }

    // We'll throw a runtime exception upon any operations after dispose.
    this._childRelays = ((null: any): Map<number, HostServicesRelay>);

    // Finally, relay to our parent that we've been disposed.
    this._parent.dispose();
  }

  async childRegister(child: HostServices): Promise<HostServices> {
    this._counter++;
    const relay = new HostServicesRelay(this, this._counter, child);
    this._childRelays.set(this._counter, relay);
    return relay;
  }
}

class HostServicesRelay {
  _aggregator: HostServicesAggregator;
  _id: number;
  //
  _child: ?HostServices;
  // _childIsDisposed is consumed by using observable.takeUntil(_childIsDisposed),
  // which unsubscribes from 'obs' as soon as _childIsDisposed.next() gets
  // fired. It is signaled by calling _disposables.dispose(), which fires
  // the _childIsDisposed.next().
  _childIsDisposed: Subject<void> = new Subject();
  _disposables: UniversalDisposable = new UniversalDisposable();

  constructor(
    aggregator: HostServicesAggregator,
    id: number,
    child: ?HostServices,
  ) {
    this._aggregator = aggregator;
    this._id = id;
    this._child = child;
    this._disposables.add(() => {
      this._childIsDisposed.next();
    });
  }

  consoleNotification(
    source: string,
    level: ShowNotificationLevel,
    text: string,
  ): void {
    this._aggregator._parent.consoleNotification(source, level, text);
  }

  dialogNotification(
    level: ShowNotificationLevel,
    text: string,
  ): ConnectableObservable<void> {
    return this._aggregator._parent
      .dialogNotification(level, text)
      .refCount()
      .takeUntil(this._childIsDisposed)
      .publish();
    // If the host is disposed, then the ConnectedObservable we return will
    // complete without ever having emitted a value. If you .toPromise on it
    // your promise will complete successfully with value 'undefined'.
  }

  dialogRequest(
    level: ShowNotificationLevel,
    text: string,
    buttonLabels: Array<string>,
    closeLabel: string,
  ): ConnectableObservable<string> {
    return this._aggregator._parent
      .dialogRequest(level, text, buttonLabels, closeLabel)
      .refCount()
      .takeUntil(this._childIsDisposed)
      .publish();
  }

  applyTextEditsForMultipleFiles(
    changes: Map<NuclideUri, Array<TextEdit>>,
  ): Promise<boolean> {
    return this._aggregator._parent.applyTextEditsForMultipleFiles(changes);
  }

  async showProgress(
    title: string,
    options?: {|debounce?: boolean|},
  ): Promise<Progress> {
    // TODO: this whole function would work better with CancellationToken,
    // particularly in the case where a HostAggregator is disposed after the
    // request has already been sent out to its parent. In the absence of
    // CancellationToken, we can't cancel the parent, and instead have to
    // wait until it *displays* progress before immediately disposing it.

    const no_op: Progress = {
      setTitle: _ => {},
      dispose: () => {},
    };

    // If we're already resolved, then return a no-op wrapper.
    if (this._disposables.disposed) {
      return no_op;
    }

    // Otherwise, we are going to make a request to our parent.
    const parentPromise = this._aggregator._parent.showProgress(title, options);
    const cancel = this._childIsDisposed.toPromise();
    let progress: ?Progress = await Promise.race([parentPromise, cancel]);

    // Should a cancellation come while we're waiting for our parent,
    // then we'll immediately return a no-op wrapper and ensure that
    // the one from our parent will eventually be disposed.
    // The "or" check below is in case both parentPromise and cancel were
    // both signalled, and parentPromise happened to win the race.
    if (progress == null || this._disposables.disposed) {
      parentPromise.then(progress2 => progress2.dispose());
      return no_op;
    }

    // Here our parent has already displayed 'winner'. It will be disposed
    // either when we ourselves get disposed, or when our caller disposes
    // of the wrapper we return them, whichever happens first.
    const wrapper: Progress = {
      setTitle: title2 => {
        if (progress != null) {
          progress.setTitle(title2);
        }
      },
      dispose: () => {
        this._disposables.remove(wrapper);
        if (progress != null) {
          progress.dispose();
          progress = null;
        }
      },
    };
    this._disposables.add(wrapper);
    return wrapper;
  }

  showActionRequired(
    title: string,
    options?: {|clickable?: boolean|},
  ): ConnectableObservable<void> {
    return this._aggregator._parent
      .showActionRequired(title, options)
      .refCount()
      .takeUntil(this._childIsDisposed)
      .publish();
  }

  dispose(): void {
    if (!this._disposables.disposed) {
      // Remember, this is a notification relayed from one of the children that
      // it has just finished its "dispose" method. That's what a relay is.
      // It is *NOT* a means to dispose of this relay
      this._disposables.dispose();
      this._aggregator._childRelays.delete(this._id);
    }
  }

  childRegister(child: HostServices): Promise<HostServices> {
    invariant(false, 'relay should never be asked to relay childRegister');
  }
}
