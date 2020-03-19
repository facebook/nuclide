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

export type AsyncRecordType = 'async-exec' | 'async-status' | 'async-notify';

export type StreamTarget = 'console' | 'target' | 'log';

export type ResultClass = 'done' | 'running' | 'connected' | 'error' | 'exit';

export type Value = string | MICommandResult | Array<Value | MICommandResult>;

export type MICommandResult = {[string]: Value};

export class MIRecord {}

// A stream record represents output. It is not tied to a particular
// command sent by the client.
export class MIStreamRecord extends MIRecord {
  _streamTarget: StreamTarget;
  _text: string;

  constructor(streamTarget: StreamTarget, text: string) {
    super();

    this._streamTarget = streamTarget;
    this._text = text;
  }

  get streamTarget(): StreamTarget {
    return this._streamTarget;
  }

  get text(): string {
    return this._text;
  }
}

// A command response record represents an event initiated by a command the
// client issued, either directly or indirectly. Command responses optionally
// have a numeric token specified by the client when the command was issued.
export class MICommandResponseRecord extends MIRecord {
  _token: ?number;
  _result: MICommandResult;

  constructor(token: ?number, result: MICommandResult) {
    super();

    this._token = token;
    this._result = result;
  }

  get token(): ?number {
    return this._token;
  }

  get result(): MICommandResult {
    return this._result;
  }
}

// An async record represents an event that happened as a side effect of
// a command, but is not the actual command result.
export class MIAsyncRecord extends MICommandResponseRecord {
  _recordType: AsyncRecordType;
  _asyncClass: string;

  constructor(
    token: ?number,
    result: MICommandResult,
    asyncClass: string,
    recordType: AsyncRecordType,
  ) {
    super(token, result);

    this._asyncClass = asyncClass;
    this._recordType = recordType;
  }

  get asyncClass(): string {
    return this._asyncClass;
  }

  get recordType(): AsyncRecordType {
    return this._recordType;
  }
}

// A result record is the direct result of a command sent from the client
export class MIResultRecord extends MICommandResponseRecord {
  _resultClass: ResultClass;

  constructor(
    token: ?number,
    result: MICommandResult,
    resultClass: ResultClass,
  ) {
    super(token, result);

    this._resultClass = resultClass;
  }

  get resultClass(): ResultClass {
    return this._resultClass;
  }

  get done(): boolean {
    return this._resultClass === 'done';
  }

  get error(): boolean {
    return this._resultClass === 'error';
  }

  get running(): boolean {
    return this._resultClass === 'running';
  }
}
