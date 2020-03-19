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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {FileChange, WatchmanSubscription} from 'nuclide-watchman-helpers';
import type {ConnectableObservable} from 'rxjs';

import nuclideUri from 'nuclide-commons/nuclideUri';
import SharedObservableCache from '../../commons-node/SharedObservableCache';
import fs from 'fs';
import {Observable} from 'rxjs';
import fsPromise from 'nuclide-commons/fsPromise';
import {getLogger} from 'log4js';
import {WatchmanClient} from 'nuclide-watchman-helpers';
import debounceDeletes from './debounceDeletes';

export type WatchResult = {
  path: NuclideUri,
  type: string,
};

type WatchEvent = 'change' | 'delete';

// Cache an observable for each watched entity (file or directory).
// Multiple watches for the same entity can share the same observable.
const entityWatches = new SharedObservableCache(registerWatch);

// In addition, expose the observer behind each observable so we can
// dispatch events from the root subscription.
const entityObserver: Map<string, rxjs$IObserver<WatchEvent>> = new Map();

const watchedDirectories: Set<string> = new Set();

let watchmanClient: ?WatchmanClient = null;
function getWatchmanClient(): WatchmanClient {
  if (watchmanClient == null) {
    watchmanClient = new WatchmanClient();
  }
  return watchmanClient;
}

export function watchFile(
  filePath: NuclideUri,
): ConnectableObservable<WatchResult> {
  return watchEntity(filePath, true).publish();
}

export function watchWithNode(
  watchedPath: NuclideUri,
  isDirectory?: boolean,
): ConnectableObservable<WatchResult> {
  return Observable.create(observer => {
    const watcher = fs.watch(
      watchedPath,
      {persistent: false},
      // Note: Flow doesn't know this, but `fs.watch` may emit null filenames.
      (eventType, fileName: ?string) => {
        let path = watchedPath;
        if (isDirectory) {
          // Be defensive if we don't know what changed.
          if (fileName == null) {
            return;
          }
          path = nuclideUri.join(watchedPath, fileName);
        }
        if (eventType === 'rename') {
          observer.next({path, type: 'delete'});
        } else {
          observer.next({path, type: 'change'});
        }
      },
    );
    return () => watcher.close();
  }).publish();
}

export function watchDirectory(
  directoryPath: NuclideUri,
): ConnectableObservable<WatchResult> {
  return watchEntity(directoryPath, false).publish();
}

function watchEntity(
  entityPath: string,
  isFile: boolean,
): Observable<WatchResult> {
  return Observable.fromPromise(
    getRealOrWatchablePath(entityPath, isFile),
  ).switchMap(realPath => debounceDeletes(entityWatches.get(realPath)));
}

// Register an observable for the given path.
function registerWatch(path: string): Observable<WatchResult> {
  return Observable.create(observer => {
    entityObserver.set(path, observer);
    return () => {
      entityObserver.delete(path);
    };
  })
    .map(type => ({path, type}))
    .share();
}

async function getRealOrWatchablePath(
  entityPath: string,
  isFile: boolean,
): Promise<string> {
  try {
    const stat = await fsPromise.stat(entityPath);
    if (stat.isFile() !== isFile) {
      getLogger('nuclide-filewatcher-rpc').warn(
        `FileWatcherService: expected ${entityPath} to be a ${
          isFile ? 'file' : 'directory'
        }`,
      );
    }

    return await fsPromise.realpath(entityPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      for (const dir of watchedDirectories) {
        if (entityPath.startsWith(nuclideUri.ensureTrailingSeparator(dir))) {
          // We have at least one watched directory that will find this path,
          // continue with the watch assuming it's canonical
          return entityPath;
        }
      }
    }
    throw error;
  }
}

export function watchDirectoryRecursive(
  directoryPath: NuclideUri,
): ConnectableObservable<string> {
  const client = getWatchmanClient();
  if (client.hasSubscription(directoryPath)) {
    return Observable.of('EXISTING').publish();
  }
  return Observable.fromPromise(
    client.watchDirectoryRecursive(
      directoryPath,
      `filewatcher-${directoryPath}`,
      // Reloading with file changes should happen
      // during source control operations to reflect the file contents / tree state.
      {defer_vcs: false},
    ),
  )
    .flatMap(watcher => {
      // Listen for watcher changes to route them to watched files and directories.
      watcher.on('change', entries => {
        onWatcherChange(watcher, entries);
      });

      watchedDirectories.add(directoryPath);

      return Observable.create(observer => {
        // Notify success watcher setup.
        observer.next('SUCCESS');

        return () => unwatchDirectoryRecursive(directoryPath);
      });
    })
    .publish();
}

function onWatcherChange(
  subscription: WatchmanSubscription,
  entries: Array<FileChange>,
): void {
  const directoryChanges = new Set();
  entries.forEach(entry => {
    const entryPath = nuclideUri.join(subscription.path, entry.name);
    const observer = entityObserver.get(entryPath);
    if (observer != null) {
      // TODO(most): handle `rename`, if needed.
      if (!entry.exists) {
        observer.next('delete');
      } else {
        observer.next('change');
      }
    }
    // A file watch event can also be considered a directory change
    // for the parent directory if a file was created or deleted.
    if (entry.new || !entry.exists) {
      directoryChanges.add(nuclideUri.dirname(entryPath));
    }
  });

  directoryChanges.forEach(watchedDirectoryPath => {
    const observer = entityObserver.get(watchedDirectoryPath);
    if (observer != null) {
      observer.next('change');
    }
  });
}

async function unwatchDirectoryRecursive(directoryPath: string): Promise<void> {
  watchedDirectories.delete(directoryPath);
  await getWatchmanClient().unwatch(directoryPath);
}
