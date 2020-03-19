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

import type {WatchmanClient, FileChange} from 'nuclide-watchman-helpers';
import {getLogger} from 'log4js';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';

/**
 * Return a map of filename => exists in response to watchman events.
 * Note that this map does not necessarily contain the status of all watched files.
 */
function filesCreateOrDeleteToObserver(
  fileChanges: Array<FileChange>,
): ?Map<string, boolean> {
  const state = new Map();
  for (const fileChange of fileChanges) {
    if (fileChange.exists) {
      // Only emit create events if watchman says the file is new.
      // Note: even if watchman debounces several changes, such as a create followed
      // shortly by a modify, we will still receive new=true.
      if (fileChange.new) {
        state.set(fileChange.name, true);
      }
    } else {
      state.set(fileChange.name, false);
    }
  }
  if (state.size > 0) {
    return state;
  }
  return null;
}

/**
 * Query the list of files for their existance at a given moment.
 * Returns an observable that emits a map of all file's existance.
 */
export function getFilesInstantaneousExistance(
  repoPath: string,
  fileNames: Array<string>,
): Observable<Map<string, boolean>> {
  return Observable.merge(
    ...fileNames.map(fileName => {
      const qualifiedFileName = nuclideUri.join(repoPath, fileName);
      return Observable.fromPromise(fsPromise.exists(qualifiedFileName)).map(
        exists => [fileName, exists],
      );
    }),
  )
    .toArray()
    .map((pairs: Array<[string, boolean]>) => {
      return new Map(pairs);
    });
}

/**
 * Set up a watchman subscription to watch for a file's creation and deletion.
 * Returns a Promise so that all such subscriptions can be awaited in bulk.
 */
export function subscribeToFilesCreateAndDelete(
  watchmanClient: WatchmanClient,
  repoPath: string,
  fileNames: Array<string>,
  subscriptionName: string,
): Observable<Map<string, boolean>> {
  const filesSubscriptionPromise = watchmanClient.watchDirectoryRecursive(
    repoPath,
    subscriptionName,
    {
      expression: ['name', fileNames, 'wholename'],
      defer_vcs: false,
    },
  );
  return Observable.fromPromise(filesSubscriptionPromise).switchMap(
    subscription => {
      getLogger('nuclide-hg-rpc').debug(
        `Watchman create/delete subscription ${subscriptionName}` +
          ` established for files: ${fileNames.join(',')}`,
      );
      return Observable.create(observer => {
        // Check each file being watched if it already exists. This is done
        // individually so that no watchman event can invalidate previously
        // checked files. We only bother updating if the file exists.
        fileNames.map(fileName => {
          const qualifiedFileName = nuclideUri.join(repoPath, fileName);
          fsPromise.exists(qualifiedFileName).then(exists => {
            if (exists) {
              observer.next(new Map([[fileName, exists]]));
              getLogger('nuclide-hg-rpc').info(
                `${subscriptionName}: watched file ${fileName} already exists`,
              );
            }
          });
        });

        const changeSubscription = subscription.on(
          'change',
          (fileChanges: Array<FileChange>) => {
            const newState = filesCreateOrDeleteToObserver(fileChanges);
            if (newState != null) {
              observer.next(newState);
            }
          },
        );
        return () => {
          getLogger('nuclide-hg-rpc').info(
            `disposing of watchman subscription ${subscriptionName}`,
          );
          changeSubscription.dispose();
          subscription.dispose();
        };
      });
    },
  );
}
