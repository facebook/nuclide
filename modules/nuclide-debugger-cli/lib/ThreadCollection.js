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

import Thread from './Thread';

export default class ThreadCollection {
  _threads: Map<number, Thread>;
  _focusThread: ?number;

  constructor() {
    this._threads = new Map();
  }

  updateThreads(threads: Array<Thread>): void {
    const newIds = new Set(threads.map(_ => _.id()));
    const existingIds = [...this._threads.keys()];

    existingIds
      .filter(_ => !newIds.has(_))
      .forEach(_ => this._threads.delete(_));

    threads.forEach(_ => {
      const thread = this._threads.get(_.id());
      if (thread != null) {
        thread.setName(_.name());
        return;
      }
      this._threads.set(_.id(), _);
    });

    if (
      this._focusThread != null &&
      this.getThreadById(this._focusThread) == null
    ) {
      this._focusThread = null;
    }
  }

  addThread(thread: Thread): void {
    this._threads.set(thread.id(), thread);
  }

  removeThread(id: number): void {
    this._threads.delete(id);
    if (this._focusThread === id) {
      this._focusThread = null;
    }
  }

  get allThreads(): Array<Thread> {
    return [...this._threads.values()];
  }

  getThreadById(id: number): ?Thread {
    return this._threads.get(id);
  }

  markThreadStopped(id: number): void {
    let thread = this.getThreadById(id);
    if (thread == null) {
      thread = new Thread(id, `Thread ${id}`);
      this.addThread(thread);
    }
    thread.setStopped();
  }

  markThreadRunning(id: number): void {
    const thread = this.getThreadById(id);
    if (thread == null) {
      throw new Error(`Attempt to mark unknown thread ${id} as running.`);
    }
    thread.setRunning();
  }

  markAllThreadsStopped(): void {
    [...this._threads.values()].forEach(thread => thread.setStopped());
  }

  markAllThreadsRunning(): void {
    [...this._threads.values()].forEach(thread => thread.setRunning());
  }

  allThreadsStopped(): boolean {
    return [...this._threads.values()].reduce((x, y) => x && y.isStopped, true);
  }

  allThreadsRunning(): boolean {
    return [...this._threads.values()].reduce(
      (x, y) => x && !y.isStopped,
      true,
    );
  }

  firstStoppedThread(): ?number {
    const stopped = [...this._threads.values()]
      .sort((a, b) => a.id() - b.id())
      .find(_ => _.isStopped);

    if (stopped == null) {
      return null;
    }

    return stopped.id();
  }

  setFocusThread(id: number): void {
    if (this.getThreadById(id) == null) {
      throw new Error(`Attempt to focus unknown thread ${id}`);
    }
    this._focusThread = id;
  }

  clearFocusThread(): void {
    this._focusThread = null;
  }

  get focusThreadId(): ?number {
    return this._focusThread;
  }

  get focusThread(): ?Thread {
    if (this._focusThread == null) {
      return null;
    }
    return this._threads.get(this._focusThread);
  }
}
