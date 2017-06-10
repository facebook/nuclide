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

import {CompositeDisposable} from 'atom';
import {observeTextEditors} from 'nuclide-commons-atom/text-editor';
import FileWatcher from './FileWatcher';

let subscriptions: ?CompositeDisposable = null;
let watchers: ?Map<any, any> = null;

export function activate(state: ?Object): void {
  const _subscriptions = new CompositeDisposable();
  const _watchers = new Map();

  _subscriptions.add(
    observeTextEditors(editor => {
      if (_watchers.has(editor)) {
        return;
      }

      const fileWatcher = new FileWatcher(editor);
      _watchers.set(editor, fileWatcher);

      _subscriptions.add(
        editor.onDidDestroy(() => {
          fileWatcher.destroy();
          _watchers.delete(editor);
        }),
      );
    }),
  );

  watchers = _watchers;
  subscriptions = _subscriptions;
}

export function deactivate(): void {
  if (subscriptions == null || watchers == null) {
    return;
  }
  for (const fileWatcher of watchers.values()) {
    fileWatcher.destroy();
  }
  subscriptions.dispose();
  subscriptions = null;
}
