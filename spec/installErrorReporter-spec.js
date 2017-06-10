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
import {Disposable} from 'atom';

let disposable;

// Create a wrapped version of the function so we can clean up.
const install = () => {
  disposable = installErrorReporter();
  return disposable;
};

describe('installErrorReporter', () => {
  let onWillThrowErrorDisposable;
  beforeEach(() => {
    onWillThrowErrorDisposable = new Disposable();
    spyOn(onWillThrowErrorDisposable, 'dispose');
    spyOn(atom, 'onWillThrowError').andReturn(onWillThrowErrorDisposable);
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

  it('gets cleaned up when you disposae of it', () => {
    const disp = install();
    disp.dispose();
    expect(onWillThrowErrorDisposable.dispose).toHaveBeenCalled();
    expect(window.removeEventListener).toHaveBeenCalled();
    expect(window.removeEventListener.mostRecentCall.args[0]).toBe(
      'unhandledrejection',
    );
  });
});
