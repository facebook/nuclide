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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ArchiveFileSystem} from './ArchiveFileSystem';
import type {ArchiveFileAsDirectory} from './ArchiveFileAsDirectory';
import type {ArchiveFile} from './ArchiveFile';
import type {ParentDirectory} from './common';

import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getParentDir, fromEntry, rejectWrite} from './common';

export class ArchiveDirectory {
  _fs: ArchiveFileSystem;
  _path: NuclideUri;

  constructor(path: NuclideUri, fs: ArchiveFileSystem) {
    this._fs = fs;
    this._path = path;
  }

  create(mode?: number): Promise<boolean> {
    return rejectWrite();
  }

  onDidChange(callback: () => mixed): IDisposable {
    return new UniversalDisposable();
  }

  isFile(): boolean {
    return false;
  }

  isDirectory(): boolean {
    return true;
  }

  exists(): Promise<boolean> {
    return this._fs.exists(this._path);
  }

  getPath(): NuclideUri {
    return this._path;
  }

  getBaseName(): string {
    return nuclideUri.basename(this._path);
  }

  relativize(fullPath: NuclideUri): string {
    return nuclideUri.relative(this._path, fullPath);
  }

  onDidRename(callback: () => void): IDisposable {
    return new UniversalDisposable();
  }

  onDidDelete(callback: () => void): IDisposable {
    return new UniversalDisposable();
  }

  getParent(): ParentDirectory {
    return getParentDir(this._fs, this._path);
  }

  getFile(name: string): ArchiveFile {
    const path = nuclideUri.join(this._path, name);
    return this._fs.newArchiveFile(path);
  }

  getSubdirectory(name: string): ArchiveDirectory {
    const path = nuclideUri.join(this._path, name);
    return this._fs.newArchiveDirectory(path);
  }

  getEntries(
    callback: (
      error: ?atom$GetEntriesError,
      entries: ?Array<ArchiveDirectory | ArchiveFile | ArchiveFileAsDirectory>,
    ) => mixed,
  ): void {
    this._fs
      .readdir(this._path)
      .then(entries =>
        entries.map(x => fromEntry(this._fs, this._path, true, x)),
      )
      .then(entries => callback(null, entries))
      .catch(error => callback(error, null));
  }

  contains(path: NuclideUri): boolean {
    const seps = [
      nuclideUri.ARCHIVE_SEPARATOR,
      nuclideUri.pathSeparatorFor(path),
    ];
    return (
      path.startsWith(this._path) &&
      path.length > this._path.length &&
      seps.includes(path.charAt(this._path.length))
    );
  }
}
