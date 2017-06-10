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

import type {Observable} from 'rxjs';

import {Subject} from 'rxjs';

type NuclideConsoleMessage = {
  data: string,
  level: string,
  startTime: string,
  categoryName: string,
};

let sub = null;
function getSubject(): Subject<NuclideConsoleMessage> {
  if (sub == null) {
    sub = new Subject();
  }
  return sub;
}

export function getNuclideConsoleMessages(): Observable<NuclideConsoleMessage> {
  return getSubject().asObservable();
}

function consoleAppender(): (loggingEvent: any) => void {
  return loggingEvent => {
    getSubject().next(loggingEvent);
  };
}

export const appender = consoleAppender;
export const configure = consoleAppender;
