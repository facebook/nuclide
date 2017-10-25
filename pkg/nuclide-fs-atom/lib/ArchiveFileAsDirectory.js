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
import type {ArchiveFile} from './ArchiveFile';
import type {ArchiveDirectory} from './ArchiveDirectory';
import type {ParentDirectory} from './common';

import {File as AtomFile} from 'atom';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {fromEntry, rejectWrite} from './common';

/**
 * This class represents the node that transitions via getParent() from inside an
 * archive file out to the root file system.  This way getParent() always returns
 * something that looks like a Directory.  However, once you getParent() on this,
 * you are out in an environment where this just looks like a file.
 */
export class ArchiveFileAsDirectory {
  _fs: ArchiveFileSystem;
  _path: NuclideUri;
  _file: AtomFile | ArchiveFile;

  symlink: boolean;

  constructor(path: NuclideUri, fs: ArchiveFileSystem) {
    this._fs = fs;
    this._path = path;
    this._file = nuclideUri.isInArchive(path)
      ? fs.newArchiveFile(path)
      : new AtomFile(path);
  }

  create(mode?: number): Promise<boolean> {
    return rejectWrite();
  }

  isFile(): boolean {
    return false;
  }

  isDirectory(): boolean {
    return true;
  }

  exists(): Promise<boolean> {
    return this._file.exists();
  }

  getPath(): NuclideUri {
    return this._file.getPath();
  }

  getBaseName(): NuclideUri {
    return this._file.getBaseName();
  }

  relativize(fullPath: NuclideUri): string {
    return nuclideUri.relative(this._path, fullPath);
  }

  onDidChange(callback: () => void): IDisposable {
    return this._file.onDidChange(callback);
  }

  onDidRename(callback: () => void): IDisposable {
    return this._file.onDidRename(callback);
  }

  onDidDelete(callback: () => void): IDisposable {
    return this._file.onDidDelete(callback);
  }

  getParent(): ParentDirectory {
    return this._file.getParent();
  }

  getFile(name: string): ArchiveFile {
    const path = nuclideUri.archiveJoin(this._path, name);
    return this._fs.newArchiveFile(path);
  }

  getSubdirectory(name: string): ArchiveDirectory {
    const path = nuclideUri.archiveJoin(this._path, name);
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
        entries.map(x => fromEntry(this._fs, this._path, false, x)),
      )
      .then(entries => callback(null, entries))
      .catch(error => callback(error, null));
  }

  contains(path: NuclideUri): boolean {
    return (
      path.startsWith(this._path) &&
      path.length > this._path.length &&
      path.charAt(this._path.length) === nuclideUri.ARCHIVE_SEPARATOR
    );
  }
}
