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
import type {DirectoryEntry} from '../../nuclide-fs';
import type {ArchiveDirectory} from './ArchiveDirectory';
import type {ArchiveFile} from './ArchiveFile';
import type {ArchiveFileAsDirectory} from './ArchiveFileAsDirectory';

import nuclideUri from 'nuclide-commons/nuclideUri';

export type ParentDirectory =
  | ArchiveDirectory
  | ArchiveFileAsDirectory
  | atom$Directory;

export function rejectWrite<T>(): Promise<T> {
  return Promise.reject(newWriteError());
}

export function rejectWriteSync<T>(): T {
  throw newWriteError();
}

function newWriteError(): Error {
  return new Error('Archives do not support write operations');
}

export function fromEntry(
  afs: ArchiveFileSystem,
  dirOrArchive: NuclideUri,
  isDir: boolean,
  entry: DirectoryEntry,
): ArchiveDirectory | ArchiveFile | ArchiveFileAsDirectory {
  const [name, isFile] = entry;
  const path = isDir
    ? nuclideUri.join(dirOrArchive, name)
    : nuclideUri.archiveJoin(dirOrArchive, name);
  if (!isFile) {
    return afs.newArchiveDirectory(path);
  } else if (nuclideUri.hasKnownArchiveExtension(name)) {
    return afs.newArchiveFileAsDirectory(path);
  } else {
    return afs.newArchiveFile(path);
  }
}

export function getParentDir(
  afs: ArchiveFileSystem,
  path: NuclideUri,
): ParentDirectory {
  const parentPath = nuclideUri.dirname(path);
  if (nuclideUri.isInArchive(parentPath)) {
    return afs.newArchiveDirectory(parentPath);
  } else {
    return afs.newArchiveFileAsDirectory(parentPath);
  }
}
