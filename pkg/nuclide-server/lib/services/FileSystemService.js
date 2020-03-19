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
import {getNuclideRealDir} from 'nuclide-commons/system-info';
import {ROOT_FS} from '../../../nuclide-fs';
import {getPathToLogDir} from '../../../nuclide-logging';

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
 * Sorts the result of readdir() by alphabetical order (case-insensitive).
 */
export async function readdirSorted(
  path: NuclideUri,
): Promise<Array<DirectoryEntry>> {
  return (await ROOT_FS.readdir(path)).sort((a, b) => {
    return a[0].toLowerCase().localeCompare(b[0].toLowerCase());
  });
}

/**
 * Recursively lists all children of the given directory. The limit param
 * puts a bound on the maximum number of entries that can be returned.
 * TODO: Consider adding concurrency while traversing search directories.
 */
export async function readdirRecursive(
  root: NuclideUri,
  limit: number = 100,
): Promise<Array<DirectoryEntry>> {
  // Keep a running array of all files and directories we encounter.
  const result = [];

  const helper = async (path): Promise<void> => {
    const entries = await ROOT_FS.readdir(nuclideUri.join(root, path));

    // We have to sort the entries to ensure that the limit is applied
    // consistently.
    entries.sort((a, b) => a[0].localeCompare(b[0]));

    for (const entry of entries) {
      // Prevent the results array from going over the limit.
      if (result.length >= limit) {
        break;
      }

      const [name, isFile, isSymbolicLink] = entry;

      // Path to this entry from root.
      const entryPath = nuclideUri.join(path, name);

      result.push([entryPath, isFile, isSymbolicLink]);

      // Recurse on directory if we aren't at the limit.
      if (!isFile && result.length < limit) {
        // eslint-disable-next-line no-await-in-loop
        await helper(entryPath);
      }
    }
  };

  await helper('.');
  return result;
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
 * Returns the specified file path with the home dir ~/ expanded.
 */
export function expandHomeDir(path: string): Promise<string> {
  return Promise.resolve(nuclideUri.expandHomeDir(path));
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
  try {
    await ROOT_FS.copy(sourcePath, destinationPath);
  } catch (err) {
    if (err.code === 'EEXIST') {
      // expected if the targetPath already exists
      return false;
    }
    throw err;
  }
  // TODO: May need to move into ROOT_FS if future filesystems support writing.
  await fsPromise.copyFilePermissions(sourcePath, destinationPath);
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
 * Runs the equivalent of `ln -s sourcePath targetPath`
 * `type` is an argument particular to Windows platforms, and will be ignored
 * on any others.
 * @return true if the operation was successful; false if it wasn't.
 */
export async function symlink(
  sourcePath: NuclideUri,
  targetPath: NuclideUri,
  type?: 'dir' | 'file' | 'junction',
): Promise<boolean> {
  try {
    await ROOT_FS.symlink(sourcePath, targetPath, type);
  } catch (err) {
    if (err.code === 'EEXIST') {
      // expected if the targetPath already exists
      return false;
    }
    throw err;
  }
  await fsPromise.copyFilePermissions(sourcePath, targetPath);
  return true;
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
  // TODO: May need to move into ROOT_FS if future filesystems support writing.
  return fsPromise.writeFileAtomic(path, data, options);
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
  return fsPromise.writeFileAtomic(path, data, options);
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

// Wrapper around fsPromise.tempdir()
export async function tempdir(prefix: string = ''): Promise<string> {
  return fsPromise.tempdir(prefix);
}

export async function getNuclideDir(): Promise<NuclideUri> {
  return getNuclideRealDir();
}

export async function getNuclideLogDir(): Promise<NuclideUri> {
  return getPathToLogDir();
}

export async function guessRealPath(path: NuclideUri): Promise<NuclideUri> {
  return fsPromise.guessRealPath(path);
}
