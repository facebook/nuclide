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

import singleton from '../../commons-node/singleton';

type PrepareStackTraceFunction = (error: Error, frames: Array<CallSite>) => any;

const PREPARE_STACK_TRACE_HOOKED_KEY = '_nuclide_error_stack_trace_hooked';

let hookedPrepareStackTrace: ?PrepareStackTraceFunction;

/**
 * v8 provided a way to customize Error stacktrace generation by overwriting
 * Error.prepareStackTrace (https://code.google.com/p/v8/wiki/JavaScriptStackTraceApi).
 * Here we added a hook to Error.prepareStackTrace to achieve following goals:
 *  1) Whenever `error.stack` is called, error.stackTrace will be generated.
 *  2) Other module's customization to Error.prepareStackTrace, no matter before or after the hook
 *     is added, will still work as expected.
 * In this way, other module could still overwrite Error.prepareStackTrace to customize stacktrace.
 * This is required as Atom's builtin coffeescript package need to show coffeescript stacktrace by
 * customize Error.prepareStackTrace.
 */
export default function addPrepareStackTraceHook(): void {
  singleton.get(PREPARE_STACK_TRACE_HOOKED_KEY, () => {
    hookedPrepareStackTrace = createHookedPrepareStackTrace(
      Error.prepareStackTrace || defaultPrepareStackTrace,
    );

    // Hook Error.prepareStackTrace by leveraging get/set accessor. In this way, writing to
    // Error.prepareStackTrace will put the new prepareStackTrace functions in a wrapper that
    // calls the hook.
    // $FlowIssue
    Object.defineProperty(Error, 'prepareStackTrace', {
      get() {
        return hookedPrepareStackTrace;
      },
      set(newValue) {
        hookedPrepareStackTrace = createHookedPrepareStackTrace(
          newValue || defaultPrepareStackTrace,
        );
      },
      enumerable: false,
      configurable: true,
    });

    // TODO (chenshen) t8789330.
    // Atom added getRawStack to Error.prototype to get Error's structured stacktrace
    // (https://github.com/atom/grim/blob/master/src/grim.coffee#L43). However, this
    // doesn't work well with our customization of stacktrace. So here we temporarily
    // walk around this by following hack, until https://github.com/atom/atom/issues/9641
    // get addressed.
    // $FlowFixMe
    Error.prototype.getRawStack = null; // eslint-disable-line no-extend-native
    return true;
  });
}

/**
 * Create a wrapper that calls to structuredStackTraceHook first, then return the result of
 * prepareStackTrace.
 */
function createHookedPrepareStackTrace(
  prepareStackTrace: PrepareStackTraceFunction,
): PrepareStackTraceFunction {
  // If the prepareStackTrace is already been hooked, just return it.
  if (prepareStackTrace.name === 'nuclideHookedPrepareStackTrace') {
    return prepareStackTrace;
  }

  const hookedFunction = function nuclideHookedPrepareStackTrace(
    error: Error,
    frames: Array<CallSite>,
  ): any {
    structuredStackTraceHook(error, frames);
    return prepareStackTrace(error, frames);
  };

  return hookedFunction;
}

function structuredStackTraceHook(error: Error, frames: Array<CallSite>): void {
  // $FlowFixMe
  error.stackTrace = frames.map(frame => {
    const scriptNameOrUrl = frame.getScriptNameOrSourceURL();
    const evalOrigin = scriptNameOrUrl == null ? null : frame.getEvalOrigin();
    return {
      functionName: frame.getFunctionName(),
      methodName: frame.getMethodName(),
      fileName: frame.getFileName(),
      lineNumber: frame.getLineNumber(),
      columnNumber: frame.getColumnNumber(),
      evalOrigin,
      isTopLevel: frame.isToplevel(),
      isEval: frame.isEval(),
      isNative: frame.isNative(),
      isConstructor: frame.isConstructor(),
    };
  });
}

function defaultPrepareStackTrace(
  error: Error,
  frames: Array<CallSite>,
): string {
  let formattedStackTrace = error.message
    ? `${error.name}: ${error.message}`
    : `${error.name}`;
  frames.forEach(frame => {
    // Do not use `maybeToString` here since lazily loading it (inline-imports) may
    // result in a circular load of `babel-core` via `nuclide-node-transpiler`.
    // https://github.com/babel/babel/blob/c2b3ea7/packages/babel-template/src/index.js#L21
    formattedStackTrace += `\n    at ${String(frame.toString())}`;
  });
  return formattedStackTrace;
}

export const __test__ = {
  createHookedPrepareStackTrace,
  resetPrepareStackTraceHooked() {
    singleton.clear(PREPARE_STACK_TRACE_HOOKED_KEY);
  },
};
