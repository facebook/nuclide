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

import type {FileSearchResult} from './rpc-types';

import {getLogger} from 'log4js';
import {arrayEqual} from 'nuclide-commons/collection';
import fsPromise from 'nuclide-commons/fsPromise';
import Task from '../../nuclide-task';

const logger = getLogger('nuclide-fuzzy-file-search-rpc');

/**
 * This is an object that lives in the main process that delegates calls to the
 * FileSearch in the forked process.
 */
class FileSearchProcess {
  _task: ?Task;
  _directory: string;
  _ignoredNames: Array<string>;

  constructor(task: Task, directory: string, ignoredNames: Array<string>) {
    this._task = task;
    task.onError(buffer => {
      logger.error(
        'File search process crashed with message:',
        buffer.toString(),
      );
      this.dispose();
    });
    task.onExit(() => this.dispose());
    this._directory = directory;
    this._ignoredNames = ignoredNames;
  }

  async query(query: string): Promise<Array<FileSearchResult>> {
    const task = this._task;
    if (task == null) {
      throw new Error('Task has been disposed');
    }
    return task.invokeRemoteMethod({
      file: require.resolve('./process/FileSearch'),
      method: 'doSearch',
      args: [this._directory, query],
    });
  }

  getIgnoredNames(): Array<string> {
    return this._ignoredNames;
  }

  dispose(): void {
    if (this._task != null) {
      delete processForDirectory[this._directory];
      this._task.dispose();
      this._task = null;
    }
  }
}

const processForDirectory: {[key: string]: Promise<FileSearchProcess>} = {};

async function newFileSearch(
  directory: string,
  ignoredNames: Array<string>,
): Promise<FileSearchProcess> {
  const exists = await fsPromise.exists(directory);
  if (!exists) {
    throw new Error('Could not find directory to search : ' + directory);
  }

  const stat = await fsPromise.stat(directory);
  if (!stat.isDirectory()) {
    throw new Error('Provided path is not a directory : ' + directory);
  }

  const task = new Task();
  await task.invokeRemoteMethod({
    file: require.resolve('./process/FileSearch'),
    method: 'initFileSearchForDirectory',
    args: [directory, ignoredNames],
  });
  return new FileSearchProcess(task, directory, ignoredNames);
}

export async function fileSearchForDirectory(
  directory: string,
  ignoredNames: Array<string>,
): Promise<FileSearchProcess> {
  const cached = processForDirectory[directory];
  if (cached != null) {
    const fileSearch = await cached;
    if (arrayEqual(fileSearch.getIgnoredNames(), ignoredNames)) {
      return fileSearch;
    }
    // In case of a mismatch, dispose and recreate the searcher task.
    fileSearch.dispose();
  }

  const promise = newFileSearch(directory, ignoredNames).catch(error => {
    // Remove errored processes from the cache so we can try again.
    delete processForDirectory[directory];
    throw error;
  });
  processForDirectory[directory] = promise;
  return promise;
}

export function getExistingSearchDirectories(): Array<string> {
  return Object.keys(processForDirectory);
}

export async function disposeSearchForDirectory(
  directory: string,
): Promise<void> {
  const cached = processForDirectory[directory];
  if (cached != null) {
    const search = await cached;
    search.dispose();
  }
}
