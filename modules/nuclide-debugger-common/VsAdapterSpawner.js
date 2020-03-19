/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {ConnectableObservable} from 'rxjs';
import type {ProcessMessage} from 'nuclide-commons/process';
import type {VSAdapterExecutableInfo, IVsAdapterSpawner} from './types';

import {
  observeProcessRaw,
  getOriginalEnvironment,
} from 'nuclide-commons/process';
import {Observable, Subject} from 'rxjs';

export default class VsAdapterSpawner implements IVsAdapterSpawner {
  _stdin: Subject<string>;

  constructor() {
    this._stdin = new Subject();
  }

  spawnAdapter(
    adapter: VSAdapterExecutableInfo,
  ): ConnectableObservable<ProcessMessage> {
    const environment = Observable.fromPromise(getOriginalEnvironment());
    return Observable.forkJoin(this._stdin.buffer(environment), environment)
      .switchMap(([stdinBuffer, env]) => {
        const options = {
          stdio: [
            'pipe', // stdin
            'pipe', // stdout
            'pipe', // stderr
          ],
          env: {...env, ELECTRON_RUN_AS_NODE: 1, ...adapter.env},
          input: Observable.from(stdinBuffer).concat(this._stdin),
          killTreeWhenDone: true,
          killTreeSignal: 'SIGKILL',
          isExitError: () => false,
          cwd: adapter.cwd == null ? undefined : adapter.cwd,
        };
        if (adapter.command === 'node') {
          adapter.command = process.execPath;
        } else if (adapter.command === 'sudo' && adapter.args[0] === 'node') {
          adapter.args[0] = process.execPath;
        }
        return observeProcessRaw(adapter.command, adapter.args, options);
      })
      .publish();
  }

  async write(input: string): Promise<void> {
    this._stdin.next(input);
  }

  async dispose(): Promise<void> {
    this._stdin.complete();
  }
}
