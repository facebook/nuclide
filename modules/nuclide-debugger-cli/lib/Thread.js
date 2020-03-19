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

import * as DebugProtocol from 'vscode-debugprotocol';

export default class Thread {
  _id: number;
  _name: string;
  _selectedStackFrame: number;
  _stopped: boolean;
  _stack: Array<DebugProtocol.StackFrame> = [];

  constructor(id: number, name: string) {
    this._id = id;
    this._name = name;
    this._stopped = false;
    this.clearSelectedStackFrame();
  }

  id(): number {
    return this._id;
  }

  name(): string {
    return this._name;
  }

  setName(name: string): void {
    this._name = name;
  }

  get isStopped(): boolean {
    return this._stopped;
  }

  clearSelectedStackFrame(): void {
    this._selectedStackFrame = 0;
  }

  selectedStackFrame(): number {
    return this._selectedStackFrame;
  }

  setSelectedStackFrame(frame: number): void {
    this._selectedStackFrame = frame;
  }

  setRunning(): void {
    this._stack = [];
    this._stopped = false;
  }

  setStopped(): void {
    this._stopped = true;
  }

  getStackFrames(): Array<DebugProtocol.StackFrame> {
    return this._stack;
  }

  addStackFrames(frames: Array<DebugProtocol.StackFrame>): void {
    this._stack = this._stack.concat(frames);
  }

  clearStackFrames() {
    this._selectedStackFrame = 0;
    this._stack = [];
  }
}
