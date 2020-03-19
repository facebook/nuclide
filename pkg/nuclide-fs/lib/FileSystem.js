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

/**
 * This code implements the NuclideFs service.  It exports the FS on http via
 * the endpoint: http://your.server:your_port/fs/method where method is one of
 * readFile, writeFile, etc.
 */

import type {ConnectableObservable} from 'rxjs';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import fs from 'fs';

// Attempting to read large files just crashes node, so just fail.
// Atom can't handle files of this scale anyway.
export const READFILE_SIZE_LIMIT = 10 * 1024 * 1024;

// [localName, isFile, isSymbolicLink]
export type DirectoryEntry = [string, boolean, boolean];

export type ReadOptions = {
  flag?: string,
};

export type WriteOptions = {
  encoding?: string,
  mode?: number,
  flag?: string,
};

export interface FileSystem {
  exists(path: NuclideUri): Promise<boolean>;
  findNearestFile(name: string, directory: NuclideUri): Promise<?NuclideUri>;
  stat(path: NuclideUri): Promise<fs.Stats>;
  lstat(path: NuclideUri): Promise<fs.Stats>;
  mkdir(path: NuclideUri): Promise<void>;
  mkdirp(path: NuclideUri): Promise<boolean>;
  chmod(path: NuclideUri, mode: number): Promise<void>;
  chown(path: NuclideUri, uid: number, gid: number): Promise<void>;
  newFile(path: NuclideUri): Promise<boolean>;
  readdir(path: NuclideUri): Promise<Array<DirectoryEntry>>;
  realpath(path: NuclideUri): Promise<NuclideUri>;
  move(from: NuclideUri, to: NuclideUri): Promise<void>;
  copy(from: NuclideUri, to: NuclideUri): Promise<void>;
  symlink(source: NuclideUri, target: NuclideUri, type?: string): Promise<void>;
  rimraf(path: NuclideUri): Promise<void>;
  unlink(path: NuclideUri): Promise<void>;
  readFile(path: NuclideUri, options?: ReadOptions): Promise<Buffer>;
  createReadStream(
    path: NuclideUri,
    options?: ReadOptions,
  ): ConnectableObservable<Buffer>;
  writeFile(
    path: NuclideUri,
    data: string,
    options?: WriteOptions,
  ): Promise<void>;
  isNfs(path: NuclideUri): Promise<boolean>;
  isFuse(path: string): Promise<boolean>;
  openArchive(path: NuclideUri): Promise<FileSystem>;
}
