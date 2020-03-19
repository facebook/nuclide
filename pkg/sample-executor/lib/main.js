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

import type {ConsoleMessage, RegisterExecutorFunction} from 'atom-ide-ui';

import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Subject} from 'rxjs';

let disposables: ?UniversalDisposable = null;

export function activate(state: ?Object): void {
  invariant(disposables == null);
  disposables = new UniversalDisposable();
}

export function deactivate(): void {
  invariant(disposables != null);
  disposables.dispose();
  disposables = null;
}

export function consumeRegisterExecutor(
  registerExecutor: RegisterExecutorFunction,
): void {
  invariant(disposables != null);
  const messages: Subject<ConsoleMessage> = new Subject();
  disposables.add(
    registerExecutor({
      id: 'echo',
      name: 'Echo',
      scopeName: () => 'text.plain',
      send(code: string): void {
        messages.next({
          level: 'log',
          text: code,
        });
      },
      output: messages.asObservable(),
    }),
  );
}
