/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
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
import {arrayCompact} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import fsPromise from 'nuclide-commons/fsPromise';
import {runCommand} from 'nuclide-commons/process';
import {observeRawStream} from 'nuclide-commons/stream';
import {Observable} from 'rxjs';
import AdmZip from 'adm-zip';
import {FileSystem, READFILE_SIZE_LIMIT} from './FileSystem';
import {ZipFileSystem} from './ZipFileSystem';

import type {DirectoryEntry, ReadOptions, WriteOptions} from './FileSystem';

export class FsFileSystem implements FileSystem {
  exists(path: NuclideUri): Promise<boolean> {
    return fsPromise.exists(path);
  }

  findNearestFile(name: string, directory: NuclideUri): Promise<?NuclideUri> {
    return fsPromise.findNearestFile(name, directory);
  }

  findInDirectories(
    name: string,
    directories: Array<NuclideUri>,
  ): ConnectableObservable<Array<NuclideUri>> {
    if (directories.length === 0) {
      return Observable.throw(
        new Error('No directories to search in!'),
      ).publish();
    }
    const findArgs = [...directories, '-type', 'f', '-name', name];
    return runCommand('find', findArgs)
      .map(stdout => stdout.split('\n').filter(filePath => filePath !== ''))
      .publish();
  }

  stat(path: NuclideUri): Promise<fs.Stats> {
    return fsPromise.stat(path);
  }

  lstat(path: NuclideUri): Promise<fs.Stats> {
    return fsPromise.lstat(path);
  }

  mkdir(path: NuclideUri): Promise<void> {
    return fsPromise.mkdir(path);
  }

  mkdirp(path: NuclideUri): Promise<boolean> {
    return fsPromise.mkdirp(path);
  }

  chmod(path: NuclideUri, mode: number): Promise<void> {
    return fsPromise.chmod(path, mode);
  }

  chown(path: NuclideUri, uid: number, gid: number): Promise<void> {
    return fsPromise.chown(path, uid, gid);
  }

  async newFile(filePath: NuclideUri): Promise<boolean> {
    const isExistingFile = await fsPromise.exists(filePath);
    if (isExistingFile) {
      return false;
    }
    await fsPromise.mkdirp(nuclideUri.dirname(filePath));
    await fsPromise.writeFile(filePath, '');
    return true;
  }

  async readdir(path: NuclideUri): Promise<Array<DirectoryEntry>> {
    const files = await fsPromise.readdir(path);
    const entries = await Promise.all(
      files.map(async file => {
        const fullpath = nuclideUri.join(path, file);
        const lstats = await fsPromise.lstat(fullpath);
        if (!lstats.isSymbolicLink()) {
          return {file, stats: lstats, isSymbolicLink: false};
        } else {
          try {
            const stats = await fsPromise.stat(fullpath);
            return {file, stats, isSymbolicLink: true};
          } catch (error) {
            return null;
          }
        }
      }),
    );
    // TODO: Return entries directly and change client to handle error.
    return arrayCompact(entries).map(entry => {
      return [entry.file, entry.stats.isFile(), entry.isSymbolicLink];
    });
  }

  realpath(path: NuclideUri): Promise<NuclideUri> {
    return fsPromise.realpath(path);
  }

  move(sourcePath: NuclideUri, destinationPath: NuclideUri): Promise<void> {
    return fsPromise.mv(sourcePath, destinationPath, {
      mkdirp: true,
      clobber: false,
    });
  }

  copy(sourcePath: NuclideUri, destinationPath: NuclideUri): Promise<void> {
    return fsPromise.copy(sourcePath, destinationPath);
  }

  symlink(
    source: NuclideUri,
    target: NuclideUri,
    type?: string,
  ): Promise<void> {
    return fsPromise.symlink(source, target, type);
  }

  rimraf(path: NuclideUri): Promise<void> {
    return fsPromise.rimraf(path);
  }

  unlink(path: NuclideUri): Promise<void> {
    return fsPromise.unlink(path).catch(error => {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    });
  }

  async readFile(path: NuclideUri, options?: ReadOptions): Promise<Buffer> {
    const stats = await fsPromise.stat(path);
    if (stats.size > READFILE_SIZE_LIMIT) {
      throw new Error(`File is too large (${stats.size} bytes)`);
    }
    return fsPromise.readFile(path, options);
  }

  createReadStream(
    path: NuclideUri,
    options?: ReadOptions,
  ): ConnectableObservable<Buffer> {
    return observeRawStream(fs.createReadStream(path, options)).publish();
  }

  writeFile(
    path: NuclideUri,
    data: string,
    options?: WriteOptions,
  ): Promise<void> {
    return fsPromise.writeFile(path, data, options);
  }

  isNfs(path: NuclideUri): Promise<boolean> {
    return fsPromise.isNfs(path);
  }

  isFuse(path: NuclideUri): Promise<boolean> {
    return fsPromise.isFuse(path);
  }

  async openArchive(path: NuclideUri): Promise<FileSystem> {
    const [buffer, stat, lstat] = await Promise.all([
      fsPromise.readFile(path),
      this.stat(path),
      this.lstat(path),
    ]);
    return new ZipFileSystem(new AdmZip(buffer), stat, lstat);
  }
}
