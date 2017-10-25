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
import {Observable} from 'rxjs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {FileSystem} from './FileSystem';

type ArchivePathSegment = {
  // `segFs` in this file refers to a lower-level FileSystem (e.g. FsFileSystem or ZipFileSystem)
  segFs: FileSystem,
  // `pth` in this file refers to the part of a path that corresponds to a given FileSystem.
  pth: NuclideUri,
  // `prefix` is the rest of the full path to the left of this segment, provides context.
  prefix: NuclideUri,
};

type SegmentFunction<T> = (
  segFs: FileSystem,
  pth: NuclideUri,
  prefix: NuclideUri,
) => Promise<T>;

const ARCHIVE_SEPARATOR = nuclideUri.ARCHIVE_SEPARATOR;

function segmentObservable<T>(
  callback: SegmentFunction<T>,
): (segment: ArchivePathSegment) => Observable<T> {
  return ({segFs, pth, prefix}) =>
    Observable.fromPromise(callback(segFs, pth, prefix));
}

export class CompositeFileSystem implements FileSystem {
  _rootFs: FileSystem;

  constructor(rootFs: FileSystem) {
    this._rootFs = rootFs;
  }

  _topDownFsPath(fullPath: NuclideUri): Observable<ArchivePathSegment> {
    const subPaths = fullPath.split(ARCHIVE_SEPARATOR);
    return Observable.of({
      segFs: this._rootFs,
      pth: subPaths[0],
      prefix: '',
    }).expand((previous, previousIndex) => {
      const index = previousIndex + 1;
      if (index < subPaths.length) {
        const prefix = subPaths.slice(0, index).join(ARCHIVE_SEPARATOR);
        const pth = subPaths[index];
        return Observable.fromPromise(
          previous.segFs
            .openArchive(previous.pth)
            .then(segFs => ({segFs, pth, prefix})),
        );
      } else {
        return Observable.empty();
      }
    });
  }

  _bottomUpFsPath(fullPath: NuclideUri): Observable<ArchivePathSegment> {
    return this._topDownFsPath(fullPath)
      .reduce((acc, x) => acc.concat(x), [])
      .concatMap(array => Observable.of(...array.reverse()));
  }

  _resolveFs<T>(
    fullPath: NuclideUri,
    callback: SegmentFunction<T>,
  ): Promise<T> {
    return this._bottomUpFsPath(fullPath)
      .first()
      .concatMap(segmentObservable(callback))
      .toPromise();
  }

  openArchive(fullPath: NuclideUri): Promise<FileSystem> {
    return this._resolveFs(fullPath, (segFs, pth) => Promise.resolve(segFs));
  }

  exists(fullPath: NuclideUri): Promise<boolean> {
    const and = (x, y) => x && y;
    return this._topDownFsPath(fullPath)
      .concatMap(segmentObservable((segFs, pth) => segFs.exists(pth)))
      .reduce(and, true)
      .toPromise()
      .catch(e => Promise.resolve(false));
  }

  async findNearestFile(name: string, dir: NuclideUri): Promise<?NuclideUri> {
    return this._bottomUpFsPath(await this._archiveAsDirectory(dir))
      .concatMap(
        segmentObservable(async (segFs, pth, prefix) =>
          maybeJoin(prefix, await segFs.findNearestFile(name, pth)),
        ),
      )
      .first()
      .toPromise();
  }

  stat(fullPath: NuclideUri): Promise<fs.Stats> {
    return this._resolveFs(fullPath, (segFs, pth) => segFs.stat(pth));
  }

  lstat(fullPath: NuclideUri): Promise<fs.Stats> {
    return this._resolveFs(fullPath, (segFs, pth) => segFs.lstat(pth));
  }

  mkdir(fullPath: NuclideUri): Promise<void> {
    rejectArchivePaths(fullPath, 'mkdir');
    return this._rootFs.mkdir(fullPath);
  }

  mkdirp(fullPath: NuclideUri): Promise<boolean> {
    rejectArchivePaths(fullPath, 'mkdirp');
    return this._rootFs.mkdirp(fullPath);
  }

  chmod(fullPath: NuclideUri, mode: number): Promise<void> {
    rejectArchivePaths(fullPath, 'chmod');
    return this._rootFs.chmod(fullPath, mode);
  }

  chown(fullPath: NuclideUri, uid: number, gid: number): Promise<void> {
    rejectArchivePaths(fullPath, 'chown');
    return this._rootFs.chown(fullPath, uid, gid);
  }

  newFile(fullPath: NuclideUri): Promise<boolean> {
    rejectArchivePaths(fullPath, 'newFile');
    return this._rootFs.newFile(fullPath);
  }

  async readdir(fullPath: NuclideUri): Promise<Array<DirectoryEntry>> {
    return this._resolveFs(
      await this._archiveAsDirectory(fullPath),
      async (segFs, pth) => {
        return (await segFs.readdir(pth)).map(([name, isFile, isLink]) => [
          name,
          isFile,
          isLink,
        ]);
      },
    );
  }

  realpath(fullPath: NuclideUri): Promise<NuclideUri> {
    return this._topDownFsPath(fullPath)
      .concatMap(segmentObservable((segFs, pth) => segFs.realpath(pth)))
      .reduce((a, s) => a + (a === '' ? '' : ARCHIVE_SEPARATOR) + s, '')
      .toPromise();
  }

  move(from: NuclideUri, to: NuclideUri): Promise<void> {
    rejectArchivePaths(from, 'move');
    rejectArchivePaths(to, 'move');
    return this._rootFs.move(from, to);
  }

  copy(from: NuclideUri, to: NuclideUri): Promise<void> {
    rejectArchivePaths(from, 'copy');
    rejectArchivePaths(to, 'copy');
    return this._rootFs.copy(from, to);
  }

  rimraf(fullPath: NuclideUri): Promise<void> {
    rejectArchivePaths(fullPath, 'rimraf');
    return this._rootFs.rimraf(fullPath);
  }

  unlink(fullPath: NuclideUri): Promise<void> {
    return this._resolveFs(fullPath, (segFs, pth) => segFs.unlink(pth));
  }

  readFile(fullPath: NuclideUri, options?: ReadOptions): Promise<Buffer> {
    return this._resolveFs(fullPath, (segFs, pth) => segFs.readFile(pth));
  }

  createReadStream(
    fullPath: NuclideUri,
    options?: ReadOptions,
  ): ConnectableObservable<Buffer> {
    return this._bottomUpFsPath(fullPath)
      .first()
      .concatMap(({segFs, pth}) =>
        segFs.createReadStream(pth, options).refCount(),
      )
      .publish();
  }

  writeFile(
    fullPath: NuclideUri,
    data: string,
    options?: WriteOptions,
  ): Promise<void> {
    rejectArchivePaths(fullPath, 'writeFile');
    return this._rootFs.writeFile(fullPath, data, options);
  }

  isNfs(fullPath: NuclideUri): Promise<boolean> {
    return this._resolveFs(fullPath, (segFs, pth) => segFs.isNfs(pth));
  }

  isFuse(fullPath: NuclideUri): Promise<boolean> {
    return this._resolveFs(fullPath, (segFs, pth) => segFs.isNfs(pth));
  }

  async _archiveAsDirectory(path: NuclideUri): Promise<NuclideUri> {
    if (
      nuclideUri.hasKnownArchiveExtension(path) &&
      (await this.exists(path)) &&
      (await this.lstat(path)).isFile()
    ) {
      return path + ARCHIVE_SEPARATOR;
    } else {
      return path;
    }
  }
}

function rejectArchivePaths(fullPath: NuclideUri, operation: string) {
  if (nuclideUri.isInArchive(fullPath)) {
    throw new Error(
      `The '${operation}' operation does not support archive paths like '${fullPath}'`,
    );
  }
}

function maybeJoin(prefix: NuclideUri, found: ?NuclideUri): ?NuclideUri {
  if (prefix === '') {
    return found;
  } else if (found == null) {
    return null;
  } else if (found === '') {
    return prefix;
  } else {
    return nuclideUri.archiveJoin(prefix, found);
  }
}
