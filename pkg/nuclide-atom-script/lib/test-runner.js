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

// PRO-TIP: To debug this file, open it in Atom, and from the console, run:
//
// ```
// require('electron').ipcRenderer.send('run-package-specs',
//    atom.workspace.getActivePaneItem().getPath());
// ```
//
// This will open it in the spec runner window. Keep in mind that the main
// process will have production options set - not test options like
// `--user-data-dir`.

import type {ExitCode, TestRunnerParams} from './types';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {shellParse} from 'nuclide-commons/string';
import {Console} from 'console';
import electron from 'electron';

const {ipcRenderer} = electron;
invariant(ipcRenderer != null);

const STDOUT_FILTERS = [
  // Always shows:
  /^window load time: \d+ms\n$/i,
];

const STDERR_FILTERS = [
  // If the script takes ~1sec or more, and there's another Atom window open,
  // then this error gets logged. It's because we set `--user-data-dir`, and
  // our process can't get a lock on the IndexedDB file.
  // https://github.com/atom/atom/blob/v1.7.3/src/state-store.js#L16
  /^Could not connect to indexedDB Event { isTrusted: \[Getter] }\n$/i,
];

// eslint-disable-next-line no-unused-vars
const debugConsole = global.console;

// https://github.com/nodejs/node/blob/v5.1.1/lib/console.js
const outputConsole = new Console(
  {
    /* stdout */
    write(chunk) {
      if (!STDOUT_FILTERS.some(re => re.test(chunk))) {
        ipcRenderer.send('write-to-stdout', chunk);
      }
    },
  },
  {
    /* stderr */
    write(chunk) {
      if (!STDERR_FILTERS.some(re => re.test(chunk))) {
        ipcRenderer.send('write-to-stderr', chunk);
      }
    },
  },
);

export default (async function runTest(
  params: TestRunnerParams,
): Promise<ExitCode> {
  let exitCode = 0;
  try {
    const atomGlobal = params.buildAtomEnvironment({
      applicationDelegate: params.buildDefaultApplicationDelegate(),
      document,
      window,
    });
    atomGlobal.atomScriptMode = true;

    invariant(typeof process.env.FILE_ATOM_SCRIPT === 'string');
    const fileAtomScript = process.env.FILE_ATOM_SCRIPT;

    invariant(typeof process.env.ARGS_ATOM_SCRIPT === 'string');
    const argsAtomScript = process.env.ARGS_ATOM_SCRIPT;

    const scriptPath = nuclideUri.resolve(fileAtomScript);
    const scriptArgs = argsAtomScript === "''"
      ? []
      : shellParse(argsAtomScript);

    // Unfortunately we have to pollute our environment if we want to take
    // advantage of Atom's v8 cache. Ideally, we'd run the script file using
    // `vm.runInNewContext`, with the ipc bridged `console` in the new context.
    // The v8 cache is activated via a monkey-patched `Module.prototype.load`,
    // which executes code with `vm.runInThisContext`. So if you want the cache
    // you have to run in this context.
    // https://github.com/atom/atom/blob/v1.7.3/src/native-compile-cache.js#L71

    global.atom = atomGlobal;
    global.console = outputConsole;

    // $FlowIgnore
    const handler = require(scriptPath);
    if (handler.__esModule && typeof handler.default === 'function') {
      // `(0, a.b)` so that `this` is undefined, like babel does.
      exitCode = await (0, handler.default)(scriptArgs);
    } else {
      exitCode = await handler(scriptArgs);
    }
  } catch (e) {
    outputConsole.error(e);
    exitCode = 1;
  }

  return exitCode;
});
