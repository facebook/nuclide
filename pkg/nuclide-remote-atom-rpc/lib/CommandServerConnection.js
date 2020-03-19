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
import type {FileCache} from '../../nuclide-open-files-rpc/lib/FileCache';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {
  iterableIsEmpty,
  filterIterable,
  iterableContains,
} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';

export class CommandServerConnection {
  _atomCommands: AtomCommands;
  _fileCache: FileCache;

  constructor(fileCache: FileCache, atomCommands: AtomCommands) {
    this._atomCommands = atomCommands;
    this._fileCache = fileCache;
  }

  getAtomCommands(): AtomCommands {
    return this._atomCommands;
  }

  hasOpenPath(filePath: NuclideUri): boolean {
    return (
      !iterableIsEmpty(
        filterIterable(this._fileCache.getOpenDirectories(), dir =>
          nuclideUri.contains(dir, filePath),
        ),
      ) || iterableContains(this._fileCache.getOpenFiles(), filePath)
    );
  }
}
