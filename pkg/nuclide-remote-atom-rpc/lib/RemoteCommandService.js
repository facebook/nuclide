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

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {FileCache} from '../../nuclide-open-files-rpc/lib/FileCache';
import {getCommandServer} from './command-server-singleton';
import invariant from 'assert';

// This interface is exposed by the nuclide server process to the client side
// Atom process.

/** Dummy alias for IDisposable to satisfy Nuclide-RPC. */
export interface Unregister {
  dispose(): void;
}

/**
 * Called by Atom once for each new remote connection.
 */
export async function registerAtomCommands(
  fileNotifier: FileNotifier,
  atomCommands: AtomCommands,
): Promise<Unregister> {
  invariant(fileNotifier instanceof FileCache);
  const fileCache = fileNotifier;

  const disposables = new UniversalDisposable();
  disposables.add(await getCommandServer().register(fileCache, atomCommands));
  return disposables;
}
