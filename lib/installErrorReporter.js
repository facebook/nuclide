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
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

let disposable;

export default function installErrorReporter(): IDisposable {
  if (disposable != null) {
    throw new Error('installErrorReporter was called multiple times.');
  }
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  disposable = new UniversalDisposable(
    atom.onWillThrowError(onUnhandledException),
    () => {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
      disposable = null;
    },
  );
  return disposable;
}

function onUnhandledException(event) {
  try {
    getLogger('installErrorReporter').error(
      `Caught unhandled exception: ${event.message}`,
      event.originalError,
    );
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
