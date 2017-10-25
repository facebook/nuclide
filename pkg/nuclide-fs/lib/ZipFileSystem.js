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

import type {ConnectableObservable} from 'rxjs';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {DirectoryEntry, ReadOptions, WriteOptions} from './FileSystem';

import fs from 'fs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';
import AdmZip from 'adm-zip';
import {FileSystem, READFILE_SIZE_LIMIT} from './FileSystem';

type ZipUri = string;

// adm-zip assumes '/' as the separator on all platforms
const ZIP_SEPARATOR = '/';

export class ZipFileSystem implements FileSystem {
  _zip: AdmZip;
  _outerStat: fs.Stats;
  _outerLStat: fs.Stats;

  constructor(zip: AdmZip, outerStat: fs.Stats, outerLStat: fs.Stats) {
    this._zip = zip;
    this._outerStat = outerStat;
    this._outerLStat = outerLStat;
  }

  getFileOrDirectoryEntry(path: NuclideUri): ?Object {
    const slashPath = slash(path);
    const file = this._zip.getEntry(slashPath);
    if (file != null) {
      return file;
    }
    return this._zip.getEntry(`${slashPath}${ZIP_SEPARATOR}`);
  }

  async exists(path: NuclideUri): Promise<boolean> {
    return this.getFileOrDirectoryEntry(path) != null;
  }

  async findNearestFile(
    name: string,
    directory: NuclideUri,
  ): Promise<?NuclideUri> {
    let check = directory;
    while (check !== '') {
      // eslint-disable-next-line no-await-in-loop
      if (await this.exists(nuclideUri.join(check, name))) {
        return check;
      }
      check = nuclideUri.getParent(check);
    }
    if (await this.exists(name)) {
      return '';
    }
  }

  async stat(path: NuclideUri): Promise<fs.Stats> {
    const lstat = await this.lstat(path);
    if (!lstat.isSymbolicLink()) {
      return lstat;
    }

    const entry = this.getFileOrDirectoryEntry(path);
    if (entry == null) {
      throw new Error(`No such file or directory: '${path}'`);
    }
    const newpath = nuclideUri.normalize(
      nuclideUri.join(nuclideUri.getParent(path), entry.getData().toString()),
    );
    return this.lstat(newpath);
  }

  async lstat(path: NuclideUri): Promise<fs.Stats> {
    const entry = this.getFileOrDirectoryEntry(path);
    if (entry == null) {
      throw new Error(`No such file or directory: '${path}'`);
    }
    return makeZipStats(this._outerLStat, entry);
  }

  readdir(path: NuclideUri): Promise<Array<DirectoryEntry>> {
    return Promise.all(
      this._zip
        .getEntries()
        .filter(entry => isImmediateChild(slash(path), entry.entryName))
        .map(entry => directoryEntryFromZipEntry(this, entry)),
    );
  }

  async realpath(path: NuclideUri): Promise<NuclideUri> {
    return path; // TODO: do we ever have symlinks in .jar files?
  }

  async readFile(path: NuclideUri, options?: ReadOptions): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const entry = this._zip.getEntry(slash(path));
      if (entry.header.size === 0) {
        resolve(new Buffer(0));
      } else if (entry.header.size > READFILE_SIZE_LIMIT) {
        reject(new Error(`File is too large (${entry.header.size} bytes)`));
      } else {
        entry.getDataAsync((data, err) => {
          if (err != null) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      }
    });
  }

  createReadStream(
    path: NuclideUri,
    options?: ReadOptions,
  ): ConnectableObservable<Buffer> {
    return Observable.defer(() =>
      Observable.fromPromise(this.readFile(path, options)),
    ).publish();
  }

  async isNfs(path: NuclideUri): Promise<boolean> {
    return false;
  }

  async isFuse(path: NuclideUri): Promise<boolean> {
    return false;
  }

  async openArchive(path: NuclideUri): Promise<FileSystem> {
    const buffer = await this.readFile(path);
    return new ZipFileSystem(buffer, this._outerStat, this._outerLStat);
  }

  mkdir(path: NuclideUri): Promise<void> {
    return rejectWrite();
  }

  mkdirp(path: NuclideUri): Promise<boolean> {
    return rejectWrite();
  }

  chmod(path: NuclideUri, mode: number): Promise<void> {
    return rejectWrite();
  }

  chown(path: NuclideUri, uid: number, gid: number): Promise<void> {
    return rejectWrite();
  }

  newFile(path: NuclideUri): Promise<boolean> {
    return rejectWrite();
  }

  move(from: NuclideUri, to: NuclideUri): Promise<void> {
    return rejectWrite();
  }

  copy(from: NuclideUri, to: NuclideUri): Promise<void> {
    return rejectWrite();
  }

  rimraf(path: NuclideUri): Promise<void> {
    return rejectWrite();
  }

  unlink(path: NuclideUri): Promise<void> {
    return rejectWrite();
  }

  writeFile(
    path: NuclideUri,
    data: string,
    options?: WriteOptions,
  ): Promise<void> {
    return rejectWrite();
  }
}

export function rejectWrite<T>(): Promise<T> {
  throw new Error('ZipFileSystem does not support write operations');
}

export function rejectWriteSync<T>(): T {
  throw new Error('ZipFileSystem does not support write operations');
}

function isImmediateChild(zipDirectory: ZipUri, zipEntryName: ZipUri): boolean {
  if (zipDirectory.length === 0) {
    return zipEntryName.lastIndexOf(ZIP_SEPARATOR, zipEntryName.length - 2) < 0;
  } else {
    const nameLength = normalLength(zipEntryName);
    return (
      zipEntryName.length > zipDirectory.length + 1 &&
      zipEntryName.startsWith(zipDirectory) &&
      zipEntryName.charAt(zipDirectory.length) === ZIP_SEPARATOR &&
      zipEntryName.lastIndexOf(ZIP_SEPARATOR, nameLength - 2) ===
        zipDirectory.length
    );
  }
}

async function directoryEntryFromZipEntry(
  zipFs: ZipFileSystem,
  entry: any,
): Promise<DirectoryEntry> {
  const nameLength = normalLength(entry.entryName);
  const nameStart = entry.entryName.lastIndexOf('/', nameLength - 1) + 1;
  const name = entry.entryName.slice(nameStart, nameLength);
  const lstat = await zipFs.lstat(entry.entryName);
  if (!lstat.isSymbolicLink()) {
    return [name, lstat.isFile(), false];
  } else {
    return [name, false, true];
  }
}

function normalLength(path: string) {
  return path.length - (path.endsWith('/') ? 1 : 0);
}

function makeZipStats(outer: fs.Stats, entry: any): fs.Stats {
  const header = entry.header;
  const stats = new fs.Stats();

  stats.dev = outer.dev;
  stats.ino = outer.ino;
  stats.mode = modeFromZipAttr(header.attr);
  stats.nlink = 1;
  stats.uid = outer.uid;
  stats.gid = outer.gid;
  stats.rdev = outer.rdev;
  stats.size = header.size;
  stats.blksize = outer.blksize;
  stats.blocks = Math.floor((header.compressedSize - 1) / outer.blksize) + 1;
  stats.atime = header.time;
  stats.mtime = header.time;
  stats.ctime = outer.ctime;

  return stats;
}

function modeFromZipAttr(attr: number): number {
  // eslint-disable-next-line no-bitwise
  return attr >>> 16;
}

function slash(uri: NuclideUri): ZipUri {
  const sep = nuclideUri.pathSeparatorFor(uri);
  if (sep === '/') {
    return uri;
  } else {
    return uri.replace(sep, '/');
  }
}
