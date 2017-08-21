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
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import rimraf from 'rimraf';

/**
 * Searches upward through the filesystem from startDir to find a file with the
 * given name.
 * @param fileName The name of the file to find
 * @param startDir Where to begin the search (e.g., cwd)
 * @param stopDir (optional) Directory where we stop the search
 * @return path to the nearest file, or null if none exists
 */
function findNearestFile(
  fileName: string,
  startDir: string,
  stopDir: ?string = null,
): Promise<?string> {
  const matcher = async path => {
    const candidate = nuclideUri.join(path, fileName);
    const result = await isFile(candidate);
    return result ? candidate : null;
  };
  return findNearest(matcher, startDir, stopDir);
}

/**
 * Searches upward through the filesystem from pathToDirectory to find a
 * directory with the given name.
 * @param dirName The name of the directory to find
 * @param startDir Where to begin the search (e.g., cwd)
 * @param stopDir (optional) Directory where we stop the search
 * @return path to the nearest directory, or null if none exists
 */
function findNearestDir(
  dirName: string,
  startDir: string,
  stopDir: ?string = null,
): Promise<?string> {
  const matcher = async path => {
    const candidate = nuclideUri.join(path, dirName);
    const stats = await stat(candidate);
    return stats && stats.isDirectory() ? candidate : null;
  };
  return findNearest(matcher, startDir, stopDir);
}

/**
 * Simultaneously looks at directories between `startDir` and `stopDir` (or root dir),
 * passing them to the provided `matcher` function and returning the string returned
 * by the logically first (nearest) matcher, or `null` if no matchers matched.
 * @param matcher: a function that returns the matched path if a match is found; otherwise null
 * @param startDir: Where to begin the search
 * @param stopDir: Where to stop the search (e.g., repository root), or null for filesystem root
 * @return the nearest matched path to startDir if a match is found; otherwise null
 */
async function findNearest(
  matcher: (candidate: string) => Promise<?string>,
  startDir: string,
  stopDir: ?string,
): Promise<?string> {
  const candidates = [];
  let candidateDir = startDir;
  while (candidateDir !== stopDir) {
    candidates.push(candidateDir);
    const parentDir = nuclideUri.dirname(candidateDir);
    if (parentDir === candidateDir) {
      // filesystem root reached
      break;
    } else {
      candidateDir = parentDir;
    }
  }
  const results = await Promise.all(candidates.map(matcher));
  for (const result of results) {
    if (result != null) {
      return result;
    }
  }
  return null;
}

/**
 * @return whether path corresponds to an ordinary file.
 */
async function isFile(path: string): Promise<boolean> {
  const stats = await stat(path);
  return stats != null && stats.isFile();
}

/**
 * async version of https://nodejs.org/api/fs.html#fs_fs_stat_path_callback.
 * @return null if there is no such file or directory for path; otherwise, fs.Stats for path.
 */
async function stat(path: string): Promise<?fs.Stats> {
  try {
    const [stats] = await toPromise(fs.stat)(path);
    return stats;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * async version of https://nodejs.org/api/fs.html#fs_fs_writefile_file_data_options_callback.
 */
function writeFile(
  file: string,
  data: string | Buffer,
  options?: Object | string,
): Promise<void> {
  return toPromise(fs.writeFile)(file, data, options);
}

/**
 * async version of https://nodejs.org/api/fs.html#fs_fs_readfile_file_options_callback.
 */
async function readFile(
  file: string,
  options: Object = {},
): Promise<string | Buffer> {
  const [data] = await toPromise(fs.readFile)(file, options);
  return data;
}

async function readFileAsString(
  file: string,
  encoding: string = 'utf8',
): Promise<string> {
  const out = await readFile(file, {encoding});
  invariant(typeof out === 'string');
  return out;
}

async function readFileAsBuffer(file: string): Promise<Buffer> {
  const out = await readFile(file);
  invariant(out instanceof Buffer);
  return out;
}

/**
 * async version of https://nodejs.org/api/fs.html#fs_fs_mkdir_path_mode_callback.
 * @param path directory to create.
 * @param mode defaults to 0o777.
 */
function mkdir(path: string, mode?: number): Promise<void> {
  return toPromise(fs.mkdir)(path, mode);
}

/**
 * @param prefix six random characters will be added to the end of this prefix.
 * @param options can be a string specifying an encoding or an object with an `encoding` property.
 */
function mkdtemp(prefix: string, options?: string | Object): Promise<string> {
  return toPromise(fs.mkdtemp)(prefix, options).then(([tempDir]) => tempDir);
}

/**
 * async version of https://nodejs.org/api/fs.html#fs_fs_mkdir_path_mode_callback.
 * @param path directory to remove.
 */
function rmdir(path: string): Promise<void> {
  return toPromise(fs.rmdir)(path);
}

/**
 * async version of https://nodejs.org/api/fs.html#fs_fs_mkdir_path_mode_callback.
 * @param path file to remove.
 */
function unlink(path: string): Promise<void> {
  return toPromise(fs.unlink)(path);
}

type RemoveOptions = {
  maxBusyTries?: number, // 3
  emfileWait?: number, // 1000
  glob?: boolean | Object, // true
};

/**
 * async version of rimraf https://github.com/isaacs/rimraf#api
 * removed the path recursively
 * @param path directory or file to delete
 * @param options
 */
async function remove(
  path: string,
  options: RemoveOptions = {},
): Promise<void> {
  await toPromise(rimraf)(path, options);
}

/**
 * Transforms any function that accepts callback as last parameter into
 * a function that returns a Promise.
 *
 * We are assuming that the callback will have a form of (error, ...results) - the node style..
 * The returned promise resolves with an array of results or rejects with an error.
 *
 * It's important to wrap the functions obtained this way with our own library
 * like we do in `commons/fs.js` to proprly type it and surface a better API if possible.
 *
 * One could argue that repeating the Promise code each time would be a bit more performant
 * but I think the code readability and brevity is more important for now. We can always
 * optimize idividual functions when we see a bottleneck.
 */
function toPromise(func: any) {
  return (...args: any) => {
    return new Promise((resolve, reject) => {
      args.push((err, ...results) => {
        if (err != null) {
          return reject(err);
        }
        resolve(results);
      });
      func(...args);
    });
  };
}

export default {
  findNearestDir,
  findNearestFile,
  isFile,
  mkdir,
  mkdtemp,
  readFileAsBuffer,
  readFileAsString,
  remove,
  rmdir,
  stat,
  unlink,
  writeFile,
};
