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
import type {DirectoryEntry, WriteOptions} from '../../../nuclide-fs';

import fs from 'fs';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {runCommand} from 'nuclide-commons/process';
import {observeRawStream} from 'nuclide-commons/stream';
import {Observable} from 'rxjs';
import {ROOT_FS} from '../../../nuclide-fs';

//------------------------------------------------------------------------------
// Services
//------------------------------------------------------------------------------

/**
 * Checks a certain path for existence and returns 'true'/'false' accordingly
 */
export function exists(path: NuclideUri): Promise<boolean> {
  return ROOT_FS.exists(path);
}

/**
 * Starting in the directory `pathToDirectory`, checks if it contains a file named `fileName`.
 * If so, it returns the path to the file. If not, it successively looks for `fileName` in the
 * parent directory. If it gets all the way to the root and still does not find the file, then it
 * returns `null`.
 */
export async function findNearestAncestorNamed(
  fileName: string,
  pathToDirectory: NuclideUri,
): Promise<?NuclideUri> {
  const directory = await ROOT_FS.findNearestFile(fileName, pathToDirectory);
  if (directory != null) {
    return nuclideUri.join(directory, fileName);
  } else {
    return null;
  }
}

export function findFilesInDirectories(
  searchPaths: Array<NuclideUri>,
  fileName: string,
): ConnectableObservable<Array<NuclideUri>> {
  if (searchPaths.length === 0) {
    return Observable.throw(
      new Error('No directories to search in!'),
    ).publish();
  }
  const findArgs = [...searchPaths, '-type', 'f', '-name', fileName];
  return runCommand('find', findArgs)
    .map(stdout => stdout.split('\n').filter(filePath => filePath !== ''))
    .publish();
}

/**
 * The lstat endpoint is the same as the stat endpoint except it will return
 * the stat of a link instead of the file the link points to.
 */
export function lstat(path: NuclideUri): Promise<fs.Stats> {
  return ROOT_FS.lstat(path);
}

/**
 * Creates a new directory with the given path.
 * Throws EEXIST error if the directory already exists.
 * Throws ENOENT if the path given is nested in a non-existing directory.
 */
export function mkdir(path: NuclideUri): Promise<void> {
  return ROOT_FS.mkdir(path);
}

/**
 * Runs the equivalent of `mkdir -p` with the given path.
 *
 * Like most implementations of mkdirp, if it fails, it is possible that
 * directories were created for some prefix of the given path.
 * @return true if the path was created; false if it already existed.
 */
export function mkdirp(path: NuclideUri): Promise<boolean> {
  return ROOT_FS.mkdirp(path);
}

/**
 * Changes permissions on a file.
 */
export function chmod(path: NuclideUri, mode: number): Promise<void> {
  return ROOT_FS.chmod(path, mode);
}

/**
 * If no file (or directory) at the specified path exists, creates the parent
 * directories (if necessary) and then writes an empty file at the specified
 * path.
 *
 * @return A boolean indicating whether the file was created.
 */
export async function newFile(filePath: NuclideUri): Promise<boolean> {
  const isExistingFile = await ROOT_FS.exists(filePath);
  if (isExistingFile) {
    return false;
  }
  await ROOT_FS.mkdirp(nuclideUri.dirname(filePath));
  await writeFile(filePath, '');
  return true;
}

/**
 * Lists all children of the given directory.
 */
export async function readdir(
  path: NuclideUri,
): Promise<Array<DirectoryEntry>> {
  return ROOT_FS.readdir(path);
}

/**
 * Gets the real path of a file path.
 * It could be different than the given path if the file is a symlink
 * or exists in a symlinked directory.
 */
export function realpath(path: NuclideUri): Promise<NuclideUri> {
  return ROOT_FS.realpath(path);
}

/**
 * Gets the real path of a file path, while expanding tilda paths and symlinks
 * like: ~/abc to its absolute path format.
 */
export function resolveRealPath(path: string): Promise<string> {
  return ROOT_FS.realpath(nuclideUri.expandHomeDir(path));
}

/**
 * Runs the equivalent of `mv sourcePath destinationPath`.
 */
export function rename(
  sourcePath: NuclideUri,
  destinationPath: NuclideUri,
): Promise<void> {
  return ROOT_FS.move(sourcePath, destinationPath);
}

/**
 * Moves all sourcePaths into the specified destDir, assumed to be a directory name.
 */
export async function move(
  sourcePaths: Array<NuclideUri>,
  destDir: NuclideUri,
): Promise<void> {
  await Promise.all(
    sourcePaths.map(path => {
      const destPath = nuclideUri.join(destDir, nuclideUri.basename(path));
      return ROOT_FS.move(path, destPath);
    }),
  );
}

/**
 * Runs the equivalent of `cp sourcePath destinationPath`.
 * @return true if the operation was successful; false if it wasn't.
 */
export async function copy(
  sourcePath: NuclideUri,
  destinationPath: NuclideUri,
): Promise<boolean> {
  const isExistingFile = await ROOT_FS.exists(destinationPath);
  if (isExistingFile) {
    return false;
  }
  await ROOT_FS.copy(sourcePath, destinationPath);
  await copyFilePermissions(sourcePath, destinationPath);
  return true;
}

/**
 * Runs the equivalent of `cp -R sourcePath destinationPath`.
 * @return true if the operation was successful; false if it wasn't.
 */
export async function copyDir(
  sourcePath: NuclideUri,
  destinationPath: NuclideUri,
): Promise<boolean> {
  const oldContents = (await Promise.all([
    mkdir(destinationPath),
    readdir(sourcePath),
  ]))[1];

  const didCopyAll = await Promise.all(
    oldContents.map(([file, isFile]) => {
      const oldItem = nuclideUri.join(sourcePath, file);
      const newItem = nuclideUri.join(destinationPath, file);
      if (isFile) {
        // it's a file, copy it
        return copy(oldItem, newItem);
      }
      // it's a directory, copy it
      return copyDir(oldItem, newItem);
    }),
  );
  // Are all the resulting booleans true?
  return didCopyAll.every(b => b);
}

/**
 * Removes directories even if they are non-empty. Does not fail if the directory doesn't exist.
 */
export function rmdir(path: NuclideUri): Promise<void> {
  return ROOT_FS.rimraf(path);
}

export async function rmdirAll(paths: Array<NuclideUri>): Promise<void> {
  await Promise.all(paths.map(p => ROOT_FS.rimraf(p)));
}

/**
 * The stat endpoint accepts the following query parameters:
 *
 *   path: path to the file to read
 *
 * It returns a JSON encoded stats object that looks something like this:
 *
 * { dev: 2114,
 *  ino: 48064969,
 *  mode: 33188,
 *  nlink: 1,
 *  uid: 85,
 *  gid: 100,
 *  rdev: 0,
 *  size: 527,
 *  blksize: 4096,
 *  blocks: 8,
 *  atime: 'Mon, 10 Oct 2011 23:24:11 GMT',
 *  mtime: 'Mon, 10 Oct 2011 23:24:11 GMT',
 *  ctime: 'Mon, 10 Oct 2011 23:24:11 GMT',
 *  birthtime: 'Mon, 10 Oct 2011 23:24:11 GMT'
 * }
 *
 */
export function stat(path: NuclideUri): Promise<fs.Stats> {
  return ROOT_FS.stat(path);
}

/**
 * Removes files. Does not fail if the file doesn't exist.
 */
export function unlink(path: NuclideUri): Promise<void> {
  return ROOT_FS.unlink(path).catch(error => {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  });
}

/**
 *   path: the path to the file to read
 *   options: options to pass to fs.readFile.
 *      Note that options does NOT include 'encoding' this ensures that the return value
 *      is always a Buffer and never a string.
 *
 *   Callers who want a string should call buffer.toString('utf8').
 */
export async function readFile(
  path: NuclideUri,
  options?: {flag?: string},
): Promise<Buffer> {
  return ROOT_FS.readFile(path, options);
}

export function createReadStream(
  path: NuclideUri,
  options?: {flag?: string},
): ConnectableObservable<Buffer> {
  return observeRawStream(fs.createReadStream(path, options)).publish();
}

/**
 * Returns true if the path being checked exists in a `NFS` mounted directory device.
 */
export function isNfs(path: NuclideUri): Promise<boolean> {
  return ROOT_FS.isNfs(path);
}

/**
 * Returns true if the path being checked exists in a `Fuse` mounted directory device.
 */
export function isFuse(path: NuclideUri): Promise<boolean> {
  return ROOT_FS.isFuse(path);
}

async function copyFilePermissions(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  try {
    const {mode, uid, gid} = await ROOT_FS.stat(sourcePath);
    await Promise.all([
      // The user may not have permissions to use the uid/gid.
      ROOT_FS.chown(destinationPath, uid, gid).catch(() => {}),
      ROOT_FS.chmod(destinationPath, mode),
    ]);
  } catch (e) {
    // If the file does not exist, then ENOENT will be thrown.
    if (e.code !== 'ENOENT') {
      throw e;
    }
    // For new files, use the default process file creation mask.
    await ROOT_FS.chmod(
      destinationPath,
      // $FlowIssue: umask argument is optional
      0o666 & ~process.umask(), // eslint-disable-line no-bitwise
    );
  }
}

/**
 * A small wrapper around fs.writeFile that also implements:
 *
 * - atomic writes (by writing to a temporary file first)
 * - uses a promise rather than a callback
 *
 * `options` is passed directly into fs.writeFile.
 */
export function writeFile(
  path: NuclideUri,
  data: string,
  options?: WriteOptions,
): Promise<void> {
  return _writeFile(path, data, options);
}

/**
 * This is the same as writeFile but with buffers.
 * The RPC framework can't use string | Buffer so we have to create a separate function.
 * Note that options.encoding is ignored for raw buffers.
 */
export function writeFileBuffer(
  path: NuclideUri,
  data: Buffer,
  options?: {encoding?: string, mode?: number, flag?: string},
): Promise<void> {
  return _writeFile(path, data, options);
}

async function _writeFile(
  path: NuclideUri,
  data: string | Buffer,
  options?: {encoding?: string, mode?: number, flag?: string},
): Promise<void> {
  let complete = false;
  const tempFilePath = await fsPromise.tempfile('nuclide');
  try {
    await fsPromise.writeFile(tempFilePath, data, options);

    // Expand the target path in case it contains symlinks.
    let realPath = path;
    try {
      realPath = await resolveRealPath(path);
    } catch (e) {
      // Fallback to using the specified path if it cannot be expanded.
      // Note: this is expected in cases where the remote file does not
      // actually exist.
    }

    // Ensure file still has original permissions:
    // https://github.com/facebook/nuclide/issues/157
    // We update the mode of the temp file rather than the destination file because
    // if we did the mv() then the chmod(), there would be a brief period between
    // those two operations where the destination file might have the wrong permissions.
    await copyFilePermissions(realPath, tempFilePath);

    // TODO(mikeo): put renames into a queue so we don't write older save over new save.
    // Use mv as fs.rename doesn't work across partitions.
    await fsPromise.mv(tempFilePath, realPath);
    complete = true;
  } finally {
    if (!complete) {
      await fsPromise.unlink(tempFilePath);
    }
  }
}

export async function getFreeSpace(path: NuclideUri): Promise<?number> {
  // Only supported on Linux for now.
  if (process.platform !== 'linux') {
    return null;
  }
  // The output of this command is "Avail\n12345678\n".
  // Just return the first line that parses to an integer.
  return runCommand('df', ['--output=avail', path])
    .map(output => {
      for (const line of output.split('\n')) {
        const number = parseInt(line, 10);
        if (Number.isInteger(number)) {
          return number;
        }
      }
    })
    .toPromise()
    .catch(() => null);
}
