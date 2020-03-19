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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import FileWatcher from './FileWatcher';

let subscriptions: ?UniversalDisposable = null;

export function activate(state: ?Object): void {
  const _subscriptions = new UniversalDisposable();
  const _watchers = new WeakSet();

  _subscriptions.add(
    atom.workspace.observeTextEditors(editor => {
      if (_watchers.has(editor)) {
        return;
      }

      const fileWatcher = new FileWatcher(editor);
      _watchers.add(editor);
      _subscriptions.addUntilDestroyed(editor, () => fileWatcher.destroy());
    }),
  );

  subscriptions = _subscriptions;
}

export function deactivate(): void {
  if (subscriptions == null) {
    return;
  }
  subscriptions.dispose();
  subscriptions = null;
}
