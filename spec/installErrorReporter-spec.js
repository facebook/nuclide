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

import installErrorReporter from '../lib/installErrorReporter';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

let disposable;

// Create a wrapped version of the function so we can clean up.
const install = () => {
  disposable = installErrorReporter();
  return disposable;
};

describe('installErrorReporter', () => {
  let onWillThrowErrorDisposable;
  let onDidAddNotification;
  beforeEach(() => {
    onWillThrowErrorDisposable = new UniversalDisposable();
    onDidAddNotification = new UniversalDisposable();
    spyOn(onWillThrowErrorDisposable, 'dispose');
    spyOn(onDidAddNotification, 'dispose');
    spyOn(atom, 'onWillThrowError').andReturn(onWillThrowErrorDisposable);
    spyOn(atom.notifications, 'onDidAddNotification').andReturn(
      onDidAddNotification,
    );
    spyOn(window, 'addEventListener');
    spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    disposable.dispose();
  });

  it('errors if called twice', () => {
    install();
    expect(installErrorReporter).toThrow(
      'installErrorReporter was called multiple times.',
    );
  });

  it('adds an unhandled rejection listener', () => {
    install();
    expect(window.addEventListener).toHaveBeenCalled();
    expect(window.addEventListener.mostRecentCall.args[0]).toBe(
      'unhandledrejection',
    );
  });

  it('adds an uncaught exception listener', () => {
    install();
    expect(atom.onWillThrowError).toHaveBeenCalled();
  });

  it('adds an onDidAddNotification event listener', () => {
    install();
    expect(atom.notifications.onDidAddNotification).toHaveBeenCalled();
  });

  it('gets cleaned up when you dispose of it', () => {
    const disp = install();
    disp.dispose();
    expect(onWillThrowErrorDisposable.dispose).toHaveBeenCalled();
    expect(onDidAddNotification.dispose).toHaveBeenCalled();
    expect(window.removeEventListener).toHaveBeenCalled();
    expect(window.removeEventListener.mostRecentCall.args[0]).toBe(
      'unhandledrejection',
    );
  });
});

describe('call stack from atom notification', () => {
  it('has nuclide in the call stack', () => {
    atom.notifications.onDidAddNotification(notification => {
      try {
        throw new Error();
      } catch (err) {
        // Ignore the first call because it comes from this function.
        const testCallSite = err
          .getRawStack()
          .slice(1)
          .find(callSite => {
            return callSite.toString().includes('installErrorReporter-spec.js');
          });
        expect(testCallSite).not.toBe(undefined);
      }
    });

    // This is the expected testCallSite.
    atom.notifications.addError('ERROR!');
  });
});
