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

import addPrepareStackTraceHook from '../lib/stacktrace';
import {__test__} from '../lib/stacktrace';

const STACK_FRAME_PROPERTIES = [
  'functionName',
  'methodName',
  'fileName',
  'lineNumber',
  'columnNumber',
  'evalOrigin',
  'isTopLevel',
  'isEval',
  'isNative',
  'isConstructor',
];

function validateStructuredStackTraceCreated(e: Error): void {
  // $FlowIssue
  expect(e.stackTrace instanceof Array).toBe(true);
  // $FlowIssue
  e.stackTrace.forEach(frame => {
    const keys = Object.keys(frame);
    STACK_FRAME_PROPERTIES.forEach(property => {
      expect(keys.indexOf(property) >= 0).toBe(true);
    });
  });
}

describe('stacktrace hook', () => {
  afterEach(() => {
    delete Error.prepareStackTrace;
    __test__.resetPrepareStackTraceHooked();
  });

  it('creates hooked prepareStackTrace', () => {
    const {createHookedPrepareStackTrace} = __test__;
    const prepareStackTrace = (error, frames) => 'test';
    const hooked = createHookedPrepareStackTrace(prepareStackTrace);
    expect(hooked.name).toBe('nuclideHookedPrepareStackTrace');
    expect(hooked !== prepareStackTrace).toBe(true);
  });

  it("does't hook a hooked function again", () => {
    const {createHookedPrepareStackTrace} = __test__;
    const prepareStackTrace = (error, frames) => 'test';
    const hooked = createHookedPrepareStackTrace(prepareStackTrace);
    expect(hooked.name).toBe('nuclideHookedPrepareStackTrace');
    expect(hooked !== prepareStackTrace).toBe(true);

    const hookedTwice = createHookedPrepareStackTrace(hooked);
    expect(hookedTwice.name).toBe('nuclideHookedPrepareStackTrace');
    expect(hookedTwice).toBe(hooked);
  });

  it('generates structured stacktrace', () => {
    addPrepareStackTraceHook();
    const e = new Error();
    // e.stackTrace won't be availabe until e.stack is called.
    // $FlowIssue
    expect(e.stackTrace).toBe(undefined);
    expect(typeof e.stack).toBe('string');
    validateStructuredStackTraceCreated(e);
  });

  it("doesn't screw up previous customization", () => {
    const customizedStack = 'There is no spoon';
    Error.prepareStackTrace = (_, frames) => {
      return customizedStack;
    };

    let e = new Error();
    // e.stack is customized.
    expect(e.stack).toBe(customizedStack);
    // $FlowIssue
    expect(e.stackTrace).toBe(undefined);

    addPrepareStackTraceHook();

    e = new Error();
    // $FlowIssue
    expect(e.stackTrace).toBe(undefined);
    // e.stack is still customized.
    expect(e.stack).toBe(customizedStack);
    validateStructuredStackTraceCreated(e);
  });

  it('support following up customization', () => {
    addPrepareStackTraceHook();

    let e = new Error();
    // $FlowIssue
    expect(e.stackTrace).toBe(undefined);
    expect(typeof e.stack).toBe('string');
    validateStructuredStackTraceCreated(e);

    const originalPrepareStackTrace = Error.prepareStackTrace;

    // Add customization and verify it works.
    const customizedStack = 'There is no spoon';
    Error.prepareStackTrace = (_, frames) => {
      return customizedStack;
    };

    e = new Error();
    expect(e.stack).toBe(customizedStack);
    validateStructuredStackTraceCreated(e);

    // Revert the customization and verify it has been reverted.
    Error.prepareStackTrace = originalPrepareStackTrace;
    e = new Error();
    // $FlowIssue
    expect(e.stackTrace).toBe(undefined);
    expect(e.stack !== customizedStack).toBe(true);
    validateStructuredStackTraceCreated(e);
  });
});
