/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import fs from 'fs';
import fsPlus from 'fs-plus';
import globLib from 'glob';
import mkdirpLib from 'mkdirp';
import mvLib from 'mv';
import rimraf from 'rimraf';
import temp from 'temp';

import nuclideUri from './nuclideUri';
import {runCommand} from './process';

/**
 * Create a temp directory with given prefix. The caller is responsible for cleaning up the
 *   drectory.
 * @param prefix optinal prefix for the temp directory name.
 * @return path to a temporary directory.
 */
function tempdir(prefix: string = ''): Promise<string> {
  return new Promise((resolve, reject) => {
    temp.mkdir(prefix, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * @return path to a temporary file. The caller is responsible for cleaning up
 *     the file.
 */
function tempfile(options: any): Promise<string> {
  return new Promise((resolve, reject) => {
    temp.open(options, (err, info) => {
      if (err) {
        reject(err);
      } else {
        fs.close(info.fd, closeErr => {
          if (closeErr) {
            reject(closeErr);
          } else {
            resolve(info.path);
          }
        });
      }
    });
  });
}

/**
 * Searches upward through the filesystem from pathToDirectory to find a file with
 * fileName.
 * @param fileName The name of the file to find.
 * @param pathToDirectory Where to begin the search. Must be a path to a directory,
 *   not a file.
 * @return directory that contains the nearest file or null.
 */
async function findNearestFile(
  fileName: string,
  pathToDirectory: string,
): Promise<?string> {
  // TODO(5586355): If this becomes a bottleneck, we should consider memoizing
  // this function. The downside would be that if someone added a closer file
  // with fileName to pathToFile (or deleted the one that was cached), then we
  // would have a bug. This would probably be pretty rare, though.
  let currentPath = nuclideUri.resolve(pathToDirectory);
  for (;;) {
    const fileToFind = nuclideUri.join(currentPath, fileName);
    // eslint-disable-next-line no-await-in-loop
    const hasFile = await exists(fileToFind);
    if (hasFile) {
      return currentPath;
    }
    if (nuclideUri.isRoot(currentPath)) {
      return null;
    }
    currentPath = nuclideUri.dirname(currentPath);
  }
}

/**
 * Searches upward through the filesystem from pathToDirectory to find the furthest
 * file with fileName.
 * @param fileName The name of the file to find.
 * @param pathToDirectory Where to begin the search. Must be a path to a directory,
 *   not a file.
 * @param stopOnMissing Stop searching when we reach a directory without fileName.
 * @return directory that contains the furthest file or null.
 */
async function findFurthestFile(
  fileName: string,
  pathToDirectory: string,
  stopOnMissing: boolean = false,
): Promise<?string> {
  let currentPath = nuclideUri.resolve(pathToDirectory);
  let result = null;
  for (;;) {
    const fileToFind = nuclideUri.join(currentPath, fileName);
    // eslint-disable-next-line no-await-in-loop
    const hasFile = await exists(fileToFind);
    if ((!hasFile && stopOnMissing) || nuclideUri.isRoot(currentPath)) {
      return result;
    } else if (hasFile) {
      result = currentPath;
    }
    currentPath = nuclideUri.dirname(currentPath);
  }
}

function getCommonAncestorDirectory(filePaths: Array<string>): string {
  let commonDirectoryPath = nuclideUri.dirname(filePaths[0]);
  while (
    filePaths.some(filePath => !filePath.startsWith(commonDirectoryPath))
  ) {
    commonDirectoryPath = nuclideUri.dirname(commonDirectoryPath);
  }
  return commonDirectoryPath;
}

function exists(filePath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.exists(filePath, resolve);
  });
}

/**
 * Runs the equivalent of `mkdir -p` with the given path.
 *
 * Like most implementations of mkdirp, if it fails, it is possible that
 * directories were created for some prefix of the given path.
 * @return true if the path was created; false if it already existed.
 */
async function mkdirp(filePath: string): Promise<boolean> {
  const isExistingDirectory = await exists(filePath);
  if (isExistingDirectory) {
    return false;
  } else {
    return new Promise((resolve, reject) => {
      mkdirpLib(filePath, err => {
        if (err) {
          reject(err);
        } else {
          resolve(true);
        }
      });
    });
  }
}

/**
 * Removes directories even if they are non-empty. Does not fail if the directory doesn't exist.
 */
function rimrafWrapper(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    rimraf(filePath, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

async function getFileSystemType(entityPath: string): Promise<?string> {
  if (process.platform === 'linux' || process.platform === 'darwin') {
    try {
      const stdout = await runCommand('stat', [
        '-f',
        '-L',
        '-c',
        '%T',
        entityPath,
      ]).toPromise();
      return stdout.trim();
    } catch (err) {
      return null;
    }
  } else {
    // TODO Handle other platforms (windows?)
    return null;
  }
}

/** @return true only if we are sure entityPath is on NFS. */
async function isNfs(entityPath: string): Promise<boolean> {
  return (await getFileSystemType(entityPath)) === 'nfs';
}

/** @return true only if we are sure entityPath is on a Fuse filesystem like
            dewey or gvfs.
*/
async function isFuse(entityPath: string): Promise<boolean> {
  return (await getFileSystemType(entityPath)) === 'fuseblk';
}

function glob(pattern: string, options?: Object): Promise<Array<string>> {
  return new Promise((resolve, reject) => {
    globLib(pattern, options, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

async function isNonNfsDirectory(directoryPath: string): Promise<boolean> {
  try {
    const stats = await stat(directoryPath);
    if (stats.isDirectory()) {
      return !await isNfs(directoryPath);
    } else {
      return false;
    }
  } catch (e) {
    // If the directory cannot be probed for whatever reason, just
    // indicate that this is not a valid candidate directory.
    // Typically this is ENOENT for missing directory.
    return false;
  }
}

/**
 * Promisified wrappers around fs-plus functions.
 */

function copy(source: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fsPlus.copy(source, dest, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * TODO: the fs-plus `writeFile` implementation runs `mkdirp` first.
 * We should use `fs.writeFile` and have callsites explicitly opt-in to this behaviour.
 */
function writeFile(
  filename: string,
  data: Buffer | string,
  options?: Object | string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    fsPlus.writeFile(filename, data, options, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

/**
 * Promisified wrappers around fs functions.
 */

function chmod(path: string, mode: number | string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.chmod(path, mode, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

function chown(path: string, uid: number, gid: number): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.chown(path, uid, gid, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

function lstat(path: string): Promise<fs.Stats> {
  return new Promise((resolve, reject) => {
    fs.lstat(path, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

function mkdir(path: string, mode?: number): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.mkdir(path, mode, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

export type MvOptions = {
  // Run mkdirp for the directory first. Defaults to false.
  mkdirp?: boolean,
  // Overwrite the file if it exists. Defaults to true.
  clobber?: boolean,
  // Optional: the concurrency limit when moving a directory.
  limit?: number,
};

/**
 * The key difference between 'mv' and 'rename' is that 'mv' works across devices.
 * It's not uncommon to have temporary files in a different disk, for instance.
 */
function mv(
  sourcePath: string,
  destinationPath: string,
  options?: MvOptions = {},
): Promise<void> {
  return new Promise((resolve, reject) => {
    mvLib(sourcePath, destinationPath, options, error => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

// `fs.readFile` returns a Buffer unless an encoding is specified.
// This workaround is adapted from the Flow declarations.
type ReadFileType = ((filename: string, encoding: string) => Promise<string>) &
  ((
    filename: string,
    options: {encoding: string, flag?: string},
  ) => Promise<string>) &
  ((filename: string, options?: {flag?: string}) => Promise<Buffer>);

const readFile: ReadFileType = (function(...args: Array<any>) {
  return new Promise((resolve, reject) => {
    // $FlowIssue: spread operator doesn't preserve any-type
    fs.readFile(...args, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}: any);

function readdir(path: string): Promise<Array<string>> {
  return new Promise((resolve, reject) => {
    fs.readdir(path, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

function readlink(path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.readlink(path, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

function realpath(path: string, cache?: Object): Promise<string> {
  return new Promise((resolve, reject) => {
    fs.realpath(path, cache, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

function stat(path: string): Promise<fs.Stats> {
  return new Promise((resolve, reject) => {
    fs.stat(path, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

function symlink(source: string, dest: string, type?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.symlink(source, dest, type, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

function unlink(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.unlink(path, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

function utimes(
  path: string,
  atime: number | Date,
  mtime: number | Date,
): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.utimes(path, atime, mtime, err => {
      if (err == null) {
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

function rmdir(path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.rmdir(path, err => {
      if (err == null) {
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

export default {
  tempdir,
  tempfile,
  findNearestFile,
  findFurthestFile,
  getCommonAncestorDirectory,
  exists,
  mkdirp,
  rimraf: rimrafWrapper,
  isNfs,
  isFuse,
  glob,
  isNonNfsDirectory,

  copy,
  writeFile,

  chmod,
  chown,
  lstat,
  mkdir,
  mv,
  readFile,
  readdir,
  readlink,
  realpath,
  stat,
  symlink,
  unlink,
  utimes,
  rmdir,
};
