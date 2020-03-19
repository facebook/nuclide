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

/**
 * This is the set of modules that are "built-in" and never need to be required.
 *
 * Mostly taken from `flow/lib/core.js`.
 */
export default (new Set([
  // Map, Set excluded on purpose for polyfilling
  'Array',
  'ArrayBuffer',
  'Boolean',
  'CallSite',
  'DataView',
  'Date',
  'Error',
  'EvalError',
  'Float32Array',
  'Float64Array',
  'Function',
  'Infinity',
  'Int16Array',
  'Int32Array',
  'Int8Array',
  'JSON',
  'Math',
  'NaN',
  'Number',
  'Object',
  'Promise',
  'Proxy',
  'RangeError',
  'ReferenceError',
  'Reflect',
  'RegExp',
  'String',
  'Symbol',
  'SyntaxError',
  'TypeError',
  'Uint16Array',
  'Uint32Array',
  'Uint8Array',
  'Uint8ClampedArray',
  'URIError',
  'WeakMap',
  'WeakSet',

  'arguments',
  'global',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'undefined',
  'console',

  // Browser built ins.
  'alert',
  'atob',
  'btoa',
  'clearInterval',
  'clearTimeout',
  'confirm',
  'decodeURI',
  'decodeURIComponent',
  'document',
  'encodeURI',
  'encodeURIComponent',
  'escape',
  'indexedDB',
  'location',
  'localStorage',
  'open',
  'performance',
  'prompt',
  'screen',
  'sessionStorage',
  'setInterval',
  'setTimeout',
  'unescape',
  'window',

  'Option',

  // Module built ins.
  'exports',
  'module',
  'require',

  // Common dev flag.
  '__DEV__',

  // Jest/Jasmine build ins.
  'afterEach',
  'beforeEach',
  'describe',
  'expect',
  'it',
  'test',
  'jest',
  'waitsForPromise',
  'jasmine',
  'spyOn',
  'mockRunTimersOnce',
]): Set<string>);
