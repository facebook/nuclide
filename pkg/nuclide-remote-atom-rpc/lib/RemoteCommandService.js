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

import type {AtomCommands} from './rpc-types';
import type {FileNotifier} from '../../nuclide-open-files-rpc/lib/rpc-types';

import {CompositeDisposable} from 'event-kit';
import {CommandServer} from './CommandServer';
import {FileCache} from '../../nuclide-open-files-rpc/lib/FileCache';
import invariant from 'assert';

// This interface is exposed by the nuclide server process to the client side
// Atom process.
export class RemoteCommandService {
  _disposables: CompositeDisposable;

  constructor() {
    this._disposables = new CompositeDisposable();
  }

  async _registerAtomCommands(
    fileNotifier: FileNotifier,
    atomCommands: AtomCommands,
  ): Promise<void> {
    invariant(fileNotifier instanceof FileCache);
    const fileCache = fileNotifier;
    this._disposables.add(
      await CommandServer.register(fileCache, atomCommands),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  // Called by Atom once for each new remote connection.
  static async registerAtomCommands(
    fileNotifier: FileNotifier,
    atomCommands: AtomCommands,
  ): Promise<RemoteCommandService> {
    const result = new RemoteCommandService();
    await result._registerAtomCommands(fileNotifier, atomCommands);
    return result;
  }
}
