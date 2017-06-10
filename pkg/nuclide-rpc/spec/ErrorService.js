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

import {Observable, ConnectableObservable} from 'rxjs';

// Contains services that let us test marshalling of Errors.

export async function promiseError(message: string): Promise<void> {
  throw new Error(message);
}

export async function promiseErrorString(message: string): Promise<void> {
  throw message;
}

export function promiseErrorUndefined(): Promise<void> {
  // eslint-disable-next-line no-throw-literal
  throw undefined;
}

export function promiseErrorCode(code: number): Promise<void> {
  throw createErrorCode(code);
}

export function observableError(
  message: string,
): ConnectableObservable<number> {
  return createErrorObservable(new Error(message));
}

export function observableErrorString(
  message: string,
): ConnectableObservable<number> {
  return createErrorObservable(message);
}

export function observableErrorUndefined(): ConnectableObservable<number> {
  return createErrorObservable(undefined);
}

export function observableErrorCode(
  code: number,
): ConnectableObservable<number> {
  return createErrorObservable(createErrorCode(code));
}

function createErrorObservable(error: any): ConnectableObservable<number> {
  return Observable.create(observer => {
    observer.error(error);
  }).publish();
}

function createErrorCode(code: number) {
  const e = new Error();
  // $FlowIssue - Error should have a code
  e.code = code;
  return e;
}
