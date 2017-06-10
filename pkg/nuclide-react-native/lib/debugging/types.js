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

export type ServerReplyCallback = (replyId: number, result: ?Object) => void;

// Output from executor.js

export type ExecutorResult = {
  kind: 'result',
  replyId: number,
  result: ?Object,
};

export type ExecutorError = {
  kind: 'error',
  message: string,
};

export type ExecutorPid = {
  kind: 'pid',
  pid: number,
};

export type ExecutorResponse = ExecutorResult | ExecutorError | ExecutorPid;

// Messages coming from React Native
export type RnMessage = {
  id: number,
  method?: string,
  arguments?: Array<any>,
  url?: string,
  inject?: string,
  $close?: boolean,

  // This shouldn't be present, but apparently can be in some situations?
  replyID?: number,
};

// Messages from RN are basically forwarded directly to the executor, so the types are pretty much
// identical.
export type ExecutorRequest = {
  id: number,
  method?: string,
  arguments?: Array<any>,
  url?: string,
  inject?: string,
};
