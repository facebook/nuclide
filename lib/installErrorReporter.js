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

import {getLogger} from 'log4js';
import {Emitter as AtomEventKitEmitter} from 'atom';
import {Emitter as NuclideEventKitEmitter} from 'event-kit';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {__DEV__} from 'nuclide-commons/runtime-info';

let disposable;

export default function installErrorReporter(): IDisposable {
  if (disposable != null) {
    throw new Error('installErrorReporter was called multiple times.');
  }

  window.addEventListener('unhandledrejection', onUnhandledRejection);

  disposable = new UniversalDisposable(
    atom.onWillThrowError(onUnhandledException),
    atom.notifications.onDidAddNotification(handleAtomNotification),
    AtomEventKitEmitter.onEventHandlerException(handleEventHandlerException),
    NuclideEventKitEmitter.onEventHandlerException(handleEventHandlerException),
    () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      disposable = null;
    },
  );
  return disposable;
}

function handleEventHandlerException(error) {
  try {
    getLogger('installErrorReporter').error(
      'Caught client event handler exception',
      error,
    );
  } catch (e) {
    // Ensure we don't recurse forever. Even under worst case scenarios.
  }
}

function onUnhandledException(event: any) {
  try {
    getLogger('installErrorReporter').error(
      `Caught unhandled exception: ${event.message}`,
      event.originalError,
    );
    if (!atom.devMode && !__DEV__) {
      // The default behavior is to open the devtools' console to surface the error.
      // Hence, we want to hide the devtools from users - but show it to nuclide developers.
      event.preventDefault();
    }
  } catch (e) {
    // Ensure we don't recurse forever. Even under worst case scenarios.
  }
}

function onUnhandledRejection(event) {
  try {
    getLogger('installErrorReporter').error(
      'Caught unhandled rejection',
      event.reason,
    );
  } catch (e) {
    // Ensure we don't recurse forever. Even under worst case scenarios.
  }
}

function isNuclideInCallStack(callStack: Array<CallSite>) {
  const ignoreCallSitesFromThisFile = callSite => {
    const fileName = callSite.getFileName();
    return fileName != null && !fileName.includes('installErrorReporter.js');
  };
  const containsNuclideWord = callSite =>
    callSite
      .toString()
      .toLowerCase()
      .includes('nuclide');

  return callStack
    .filter(ignoreCallSitesFromThisFile)
    .some(containsNuclideWord);
}

function handleAtomNotification(notification: atom$Notification) {
  // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
  if (notification.type !== 'error' && notification.type !== 'fatal') {
    return;
  }

  const error = Error(notification.getMessage());
  const {stack} = notification.getOptions();
  if (typeof stack === 'string' && stack) {
    error.stack = stack;
  } else {
    // This will exclude handleAtomNotification from the stack.
    Error.captureStackTrace(error, handleAtomNotification);
  }

  // $FlowFixMe: getRawStack() is missing from Error()
  const rawStack = error.getRawStack();
  if (rawStack == null || isNuclideInCallStack(rawStack)) {
    getLogger('atom-error-notification').error(error);
  }
}
