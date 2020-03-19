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

import typeof * as CodeSearchService from '../../nuclide-code-search-rpc';
import type {search$FileResult} from '../../nuclide-code-search-rpc/lib/types';
import type {WorkingSetsStore} from '../../nuclide-working-sets/lib/types';
import type {NuclideCodeSearchConfig} from '../../nuclide-code-search/lib/types';

import {RemoteDirectory} from '../../nuclide-remote-connection';
import {WORKING_SET_PATH_MARKER} from '../../nuclide-working-sets-common/lib/constants';
import {logger} from './constants';
import invariant from 'assert';
import {arrayFlatten} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {Observable, ReplaySubject} from 'rxjs';

type RemoteDirectorySearch = {
  then: (onFullfilled: any, onRejected: any) => Promise<any>,
  cancel: () => void,
};

export default class RemoteDirectorySearcher {
  _serviceProvider: (dir: RemoteDirectory) => CodeSearchService;
  _getWorkingSetsStore: () => ?WorkingSetsStore;

  // When constructed, RemoteDirectorySearcher must be passed a function that
  // it can use to get a 'CodeSearchService' for a given remote path.
  constructor(
    serviceProvider: (dir: RemoteDirectory) => CodeSearchService,
    getWorkingSetsStore: () => ?WorkingSetsStore,
  ) {
    this._serviceProvider = serviceProvider;
    this._getWorkingSetsStore = getWorkingSetsStore;
  }

  canSearchDirectory(directory: atom$Directory | RemoteDirectory): boolean {
    return RemoteDirectory.isRemoteDirectory(directory);
  }

  search(
    directories: Array<RemoteDirectory>,
    regex: RegExp,
    options: Object,
  ): RemoteDirectorySearch {
    const config: NuclideCodeSearchConfig = (featureConfig.get(
      'nuclide-code-search',
    ): any);
    // Track the files that we have seen updates for.
    const seenFiles = new Set();

    // Get the remote service that corresponds to each remote directory.
    const services = directories.map(dir => this._serviceProvider(dir));

    const includePaths = directories.map(dir =>
      this.processPaths(dir.getPath(), options.inclusions),
    );

    const searchStreams: Array<
      Observable<search$FileResult>,
    > = includePaths.map(
      (inclusion, index) =>
        // processPaths returns null if the inclusions are too strict for the
        // given directory, so we don't even want to start the search. This can
        // happen if we're searching in a working set that excludes the directory.
        inclusion
          ? services[index]
              .remoteAtomSearch(
                directories[index].getPath(),
                regex,
                inclusion,
                config.remoteUseVcsSearch,
                config.remoteTool.length === 0 ? null : config.remoteTool,
                options.leadingContextLineCount,
                options.trailingContextLineCount,
              )
              .refCount()
          : Observable.empty(),
    );

    // Start the search in each directory, and merge the resulting streams.
    const searchStream = Observable.merge(...searchStreams);

    // Create a subject that we can use to track search completion.
    const searchCompletion = new ReplaySubject();
    searchCompletion.next();

    const subscription = searchStream.subscribe(
      next => {
        options.didMatch(next);

        // Call didSearchPaths with the number of unique files we have seen matches in. This is
        // not technically correct, as didSearchPaths is also supposed to count files for which
        // no matches were found. However, we currently have no way of obtaining this information.
        seenFiles.add(next.filePath);
        options.didSearchPaths(seenFiles.size);
      },
      error => {
        options.didError(error);
        searchCompletion.error(error);
      },
      () => {
        searchCompletion.complete();
      },
    );

    // Return a promise that resolves on search completion.
    const completionPromise = searchCompletion.toPromise();
    return {
      then: completionPromise.then.bind(completionPromise),
      cancel() {
        // Cancel the subscription, which should also kill the grep process.
        subscription.unsubscribe();
      },
    };
  }

  /**
   * If a query's prefix matches the rootPath's basename, treat the query as a relative search.
   * Based on https://github.com/atom/atom/blob/master/src/scan-handler.coffee.
   * Returns null if we shouldn't search rootPath.
   */
  processPaths(rootPath: string, paths: ?Array<string>): ?Array<string> {
    if (paths == null) {
      return [];
    }
    const rootPathBase = nuclideUri.basename(rootPath);
    const results = [];
    for (const path of paths) {
      if (path === WORKING_SET_PATH_MARKER) {
        const workingSetsStore = this._getWorkingSetsStore();
        if (!workingSetsStore) {
          logger.error(
            'workingSetsStore not found but trying to search in working sets',
          );
          continue;
        }

        const workingSetUris = arrayFlatten(
          workingSetsStore
            .getApplicableDefinitions()
            .filter(def => def.active)
            .map(def => def.uris),
        )
          // A working set can contain paths outside of rootPath. Ignore these.
          .filter(uri => nuclideUri.contains(rootPath, uri))
          // `processPaths` expects the second argument to be a relative path
          // instead of the fully qualified NuclideUris we have here.
          .map(uri => nuclideUri.relative(rootPath, uri));

        if (workingSetUris.length === 0) {
          // Working set and rootPath are disjoint, we shouldn't search rootPath
          return null;
        }

        invariant(!workingSetUris.includes(WORKING_SET_PATH_MARKER));
        const processed = this.processPaths(rootPath, workingSetUris);
        invariant(processed);
        results.push(...processed);
        continue;
      }

      const segments = nuclideUri.split(path);
      const firstSegment = segments.shift();
      results.push(path);
      if (firstSegment === rootPathBase) {
        if (segments.length === 0) {
          // Search everything.
          return [];
        } else {
          // Try interpreting this as a subdirectory of the base as well.
          results.push(nuclideUri.join(...segments));
        }
      }
    }
    return results;
  }
}
