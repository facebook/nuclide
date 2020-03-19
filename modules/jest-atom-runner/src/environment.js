/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

/* eslint-disable nuclide-internal/no-commonjs */

import type {ProjectConfig} from './types';

import mock from 'jest-mock';

class Atom {
  global: Object;
  moduleMocker: Object;
  fakeTimers: Object;

  constructor(config: ProjectConfig) {
    this.global = global;
    // __buildAtomGlobal should be set at the atom entry point. It depends
    // on the data Atom test runner provides.
    global.atom = global.__buildAtomGlobal();
    this.moduleMocker = new mock.ModuleMocker(global);
    this.fakeTimers = {
      useFakeTimers() {
        throw new Error('fakeTimers are not supproted in atom environment');
      },
    };
  }

  async setup() {
    // make sure we start from a clean state
    window.document.body.innerHTML = '';
  }

  async teardown() {}

  runScript(script: any): ?any {
    // unfortunately electron crashes if we try to access anything
    // on global from within a vm content. The only workaround i found
    // is to lose sandboxing and run everything in a single context.
    // We should look into using iframes/webviews in the future.
    return script.runInThisContext();
  }
}

module.exports = Atom;
