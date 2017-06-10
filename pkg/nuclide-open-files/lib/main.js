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

import type {FileVersion} from '../../nuclide-open-files-rpc/lib/rpc-types';
import type {ServerConnection} from '../../nuclide-remote-connection';
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';

import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  observeBufferOpen,
  observeBufferCloseOrRename,
} from '../../commons-atom/text-buffer';
import {NotifiersByConnection} from './NotifiersByConnection';
import {BufferSubscription} from './BufferSubscription';

export class Activation {
  _disposables: UniversalDisposable;
  notifiers: NotifiersByConnection;

  constructor(state: ?Object) {
    this._disposables = new UniversalDisposable();

    const notifiers = new NotifiersByConnection();
    this.notifiers = notifiers;
    this._disposables.add(notifiers);

    this._disposables.add(
      observeBufferOpen().subscribe(buffer => {
        const subscriptions = new UniversalDisposable();
        subscriptions.add(new BufferSubscription(notifiers, buffer));
        subscriptions.add(
          observeBufferCloseOrRename(buffer).subscribe(closeEvent => {
            this._disposables.remove(subscriptions);
            subscriptions.dispose();
          }),
        );
        this._disposables.add(subscriptions);
      }),
    );
  }

  dispose() {
    this._disposables.dispose();
  }
}

// Mutable for testing.
let activation: ?Activation = new Activation();

// exported for testing
export function reset(): void {
  if (activation != null) {
    activation.dispose();
    activation = null;
  }
}
export function getActivation(): Activation {
  if (activation == null) {
    activation = new Activation();
  }
  return activation;
}

export function getNotifierByConnection(
  connection: ?ServerConnection,
): Promise<FileNotifier> {
  return getActivation().notifiers.getForConnection(connection);
}

export async function getFileVersionOfBuffer(
  buffer: atom$TextBuffer,
): Promise<?FileVersion> {
  const filePath = buffer.getPath();
  const notifier = getActivation().notifiers.getForUri(filePath);
  if (notifier == null) {
    return null;
  }
  invariant(filePath != null);
  return {
    notifier: await notifier,
    filePath,
    version: buffer.changeCount,
  };
}

export function getFileVersionOfEditor(
  editor: atom$TextEditor,
): Promise<?FileVersion> {
  return getFileVersionOfBuffer(editor.getBuffer());
}
