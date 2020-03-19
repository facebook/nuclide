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

type WriteOptions = {
  encoding?: string,
  mode?: number,
  flag?: string,
};

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

async function findNearestAncestorNamed(
  fileName: string,
  pathToDirectory: string,
): Promise<?string> {
  const directory = await findNearestFile(fileName, pathToDirectory);
  if (directory != null) {
    return nuclideUri.join(directory, fileName);
  } else {
    return null;
  }
}

function resolveRealPath(path: string): Promise<string> {
  return realpath(nuclideUri.expandHomeDir(path));
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
      return !(await isNfs(directoryPath));
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

async function copyFilePermissions(
  sourcePath: string,
  destinationPath: string,
): Promise<void> {
  try {
    const {mode, uid, gid} = await stat(sourcePath);
    await Promise.all([
      // The user may not have permissions to use the uid/gid.
      chown(destinationPath, uid, gid).catch(() => {}),
      chmod(destinationPath, mode),
    ]);
  } catch (e) {
    // If the file does not exist, then ENOENT will be thrown.
    if (e.code !== 'ENOENT') {
      throw e;
    }
    // For new files, use the default process file creation mask.
    await chmod(
      destinationPath,
      0o666 & ~process.umask(), // eslint-disable-line no-bitwise
    );
  }
}

/**
 * TODO: the fs-plus `writeFile` implementation runs `mkdirp` first.
 * We should use `fs.writeFile` and have callsites explicitly opt-in to this behaviour.
 */
function writeFile(
  filename: string,
  data: Buffer | string,
  options?: WriteOptions | string,
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

async function writeFileAtomic(
  path: string,
  data: Buffer | string,
  options?: WriteOptions | string,
): Promise<void> {
  const tempFilePath = await tempfile('nuclide');
  try {
    await writeFile(tempFilePath, data, options);

    // Expand the target path in case it contains symlinks.
    let realPath = path;
    try {
      realPath = await realpath(path);
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

    // Ensure file has new permissions updated.
    const mode = typeof options !== 'string' ? options?.mode : null;
    if (mode != null) {
      await chmod(tempFilePath, mode);
    }

    // TODO: put renames into a queue so we don't write older save over new save.
    // Use mv as fs.rename doesn't work across partitions.
    await mv(tempFilePath, realPath, {mkdirp: true});
  } catch (err) {
    await unlink(tempFilePath);
    throw err;
  }
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

function close(fd: number): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.close(fd, err => {
      if (err == null) {
        resolve();
      } else {
        reject(err);
      }
    });
  });
}

function fstat(fd: number): Promise<fs.Stats> {
  return new Promise((resolve, reject) => {
    fs.fstat(fd, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

async function fsync(fd: number): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.fsync(fd, (err, result) => {
      if (err == null) {
        resolve(result);
      } else {
        reject(err);
      }
    });
  });
}

function ftruncate(fd: number, len: number): Promise<void> {
  return new Promise((resolve, reject) => {
    fs.ftruncate(fd, len, (err, result) => {
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
async function mv(
  sourcePath: string,
  destinationPath: string,
  options?: MvOptions = {},
): Promise<void> {
  // mv-node fails to account for the case where a destination directory exists
  // and `clobber` is false. This can result in the source directory getting
  // deleted but the destination not getting written.
  // https://github.com/andrewrk/node-mv/issues/30
  if (options.clobber === false && (await exists(destinationPath))) {
    const err: ErrnoError = new Error('Destination file exists');
    err.code = 'EEXIST';
    err.path = destinationPath;
    throw err;
  }
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

function open(
  path: string | Buffer | URL,
  flags: string | number,
  mode: number = 0o666,
): Promise<number> {
  return new Promise((resolve, reject) => {
    fs.open(path, flags, mode, (err, fd) => {
      if (err == null) {
        resolve(fd);
      } else {
        reject(err);
      }
    });
  });
}

function read(
  fd: number,
  buffer: Buffer,
  offset: number,
  length: number,
  position: number | null,
): Promise<number> {
  return new Promise((resolve, reject) => {
    fs.read(fd, buffer, offset, length, position, (err, bytesRead) => {
      if (err == null) {
        resolve(bytesRead);
      } else {
        reject(err);
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

function access(path: string, mode: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    fs.access(path, mode, err => {
      if (err == null) {
        resolve(true);
      } else {
        resolve(false);
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

/**
 * A utility function to grab the last N bytes from a file. Attempts to do so
 * without reading the entire file.
 */
async function tailBytes(file: string, maxBytes: number): Promise<Buffer> {
  if (maxBytes <= 0) {
    throw new Error('tailbytes expects maxBytes > 0');
  }

  // Figure out the size so we know what strategy to use
  const {size: file_size} = await stat(file);

  if (file_size > maxBytes) {
    const fd = await open(file, 'r');
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = await read(
      fd,
      buffer,
      0, // buffer offset
      maxBytes, // length to read
      file_size - maxBytes, // file offset
    );
    await close(fd);

    /* If we meant to read the last 100 bytes but only read 50 bytes, then we've
     * failed to read the last 100 bytes. So throw. In the future, someone
     * could update this code to keep calling `read` until we read maxBytes.
     */
    if (bytesRead !== maxBytes) {
      throw new Error(
        `Failed to tail file. Intended to read ${maxBytes} bytes but ` +
          `only read ${bytesRead} bytes`,
      );
    }
    return buffer;
  } else {
    return readFile(file);
  }
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

/**
 * Attempts to resolve the physical path of the filename.
 * Sometimes filePath may not exist yet, in which case we need to look upwards
 * for the first prefix that actually does exist.
 */
async function guessRealPath(filePath: string): Promise<string> {
  if (nuclideUri.isRemote(filePath)) {
    throw new Error('Only local paths can be used with guessRealPath');
  }
  const resolved = nuclideUri.resolve(filePath);
  let prefix = resolved;
  let suffix = null;
  while (true) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const realPath = await realpath(prefix);
      return suffix == null ? realPath : nuclideUri.join(realPath, suffix);
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err;
      }
      const basename = nuclideUri.basename(prefix);
      if (basename === '') {
        // We've reached the filesystem root.
        break;
      }
      suffix = suffix == null ? basename : nuclideUri.join(basename, suffix);
      prefix = nuclideUri.dirname(prefix);
    }
  }
  return resolved;
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
  copyFilePermissions,
  writeFile,
  writeFileAtomic,

  chmod,
  chown,
  close,
  fstat,
  fsync,
  ftruncate,
  lstat,
  mkdir,
  mv,
  open,
  read,
  readFile,
  readdir,
  readlink,
  realpath,
  stat,
  symlink,
  tailBytes,
  unlink,
  utimes,
  rmdir,
  access,

  findNearestAncestorNamed,
  resolveRealPath,
  guessRealPath,
};
