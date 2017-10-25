/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import type {BusyMessage, BusySignalOptions} from './types';

import invariant from 'assert';
import {Observable, BehaviorSubject} from 'rxjs';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {arrayEqual} from 'nuclide-commons/collection';
import {BusyMessageInstance} from './BusyMessageInstance';

// The "busy debounce delay" is for busy messages that were created with the
// 'debounce' option set to true. The icon and tooltip message won't appear
// until this many milliseconds have elapsed; if the busy message gets disposed
// before this time, then the user won't see anything.
const BUSY_DEBOUNCE_DELAY = 300;

export class MessageStore {
  _counter: number = 0;
  _messages: Set<BusyMessageInstance> = new Set();
  _currentVisibleMessages: Array<BusyMessageInstance> = [];
  _messageStream: BehaviorSubject<
    Array<BusyMessageInstance>,
  > = new BehaviorSubject([]);

  getMessageStream(): Observable<Array<BusyMessageInstance>> {
    return this._messageStream;
  }

  dispose(): void {
    const messagesToDispose = [...this._messages];
    for (const message of messagesToDispose) {
      message.dispose();
    }
    invariant(this._messages.size === 0);
    this._messageStream.complete();
  }

  _publish(): void {
    // Currently visible messages should no longer reveal the tooltip again.
    this._currentVisibleMessages.forEach(message =>
      message.setRevealTooltip(false),
    );
    const visibleMessages = [...this._messages]
      .filter(m => m.isVisible())
      .sort((m1, m2) => m1.compare(m2));

    // We only send out on messageStream when the list of visible
    // BusyMessageInstance object identities has changed, e.g. when ones
    // are made visible or invisible or new ones are created. We don't send
    // out just on title change.
    if (!arrayEqual(this._currentVisibleMessages, visibleMessages)) {
      this._messageStream.next(visibleMessages);
      this._currentVisibleMessages = visibleMessages;
    }
  }

  add(title: string, options: BusySignalOptions): BusyMessage {
    this._counter++;

    const creationOrder = this._counter;
    const waitingFor =
      options != null && options.waitingFor != null
        ? options.waitingFor
        : 'computer';
    const onDidClick = options == null ? null : options.onDidClick;
    const messageDisposables = new UniversalDisposable();

    const message = new BusyMessageInstance(
      this._publish.bind(this),
      creationOrder,
      waitingFor,
      onDidClick,
      messageDisposables,
    );
    this._messages.add(message);
    messageDisposables.add(() => this._messages.delete(message));

    // debounce defaults 'true' for busy-signal, and 'false' for action-required
    const debounceRaw: ?boolean = options == null ? null : options.debounce;
    const debounce: boolean =
      debounceRaw == null ? waitingFor === 'computer' : debounceRaw;
    if (debounce) {
      message.setIsVisibleForDebounce(false);
      // After the debounce time, we'll check whether the messageId is still
      // around (i.e. hasn't yet been disposed), and if so we'll display it.
      let timeoutId = 0;
      const teardown = () => clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        invariant(!messageDisposables.disposed);
        invariant(this._messages.has(message));
        // If the message was disposed, then it should have already called
        // clearTimeout, so this timeout handler shouldn't have been invoked.
        // And also the message should have been removed from this._messages.
        // So both tests above should necessary fail.
        // If the messageStore was disposed, then every message in it should
        // already have been disposed, as per above.
        messageDisposables.remove(teardown);
        message.setIsVisibleForDebounce(true);
      }, BUSY_DEBOUNCE_DELAY);
      messageDisposables.add(teardown);
    }

    if (options != null && options.onlyForFile != null) {
      message.setIsVisibleForFile(false);
      const file = options.onlyForFile;
      const teardown = atom.workspace.observeActivePaneItem(item => {
        const activePane =
          item != null && typeof item.getPath === 'function'
            ? String(item.getPath())
            : null;
        const newVisible = activePane === file;
        message.setIsVisibleForFile(newVisible);
      });
      messageDisposables.add(teardown);
    }

    if (options.revealTooltip) {
      // When the UI component receives this message, it'll reveal the tooltip.
      // We'll clear this flag after the message becomes visible the first time.
      message.setRevealTooltip(true);
    }

    message.setTitle(title);

    // Quick note that there aren't races in the above code! 'message' will not
    // be displayed until it has a title. So we can set visibility all we like,
    // and then when the title is set, it will display or not as appropriate.

    return message;
  }
}
