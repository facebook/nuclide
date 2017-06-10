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

import {BehaviorSubject, Observable} from 'rxjs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {areSetsEqual} from 'nuclide-commons/collection';
import {FileEventKind} from './constants';
import {FileCache} from './FileCache';

export class ConfigObserver {
  _fileExtensions: Array<string>;
  _fileCache: FileCache;
  _currentConfigs: BehaviorSubject<Set<NuclideUri>>;
  _subscription: rxjs$ISubscription;
  _findConfigDir: (path: NuclideUri) => Promise<?NuclideUri>;

  constructor(
    cache: FileCache,
    fileExtensions: Array<string>,
    findConfigDir: (path: NuclideUri) => Promise<?NuclideUri>,
  ) {
    this._fileCache = cache;
    this._fileExtensions = fileExtensions;
    this._findConfigDir = findConfigDir;
    this._currentConfigs = new BehaviorSubject(new Set());
    // TODO: Consider incrementally updating, rather than recomputing on each event.
    this._subscription = cache
      .observeFileEvents()
      .filter(fileEvent => fileEvent.kind !== FileEventKind.EDIT)
      .mapTo(undefined)
      .merge(cache.observeDirectoryEvents().mapTo(undefined))
      .switchMap(() => Observable.fromPromise(this._computeOpenConfigs()))
      .distinctUntilChanged(areSetsEqual)
      // Filter out initial empty set, which duplicates the initial value of the BehaviorSubject
      .skipWhile(dirs => dirs.size === 0)
      .subscribe(this._currentConfigs);
  }

  async _computeOpenConfigs(): Promise<Set<NuclideUri>> {
    const paths = Array.from(this._fileCache.getOpenDirectories()).concat(
      Array.from(this._fileCache.getOpenFiles()).filter(
        filePath =>
          this._fileExtensions.indexOf(nuclideUri.extname(filePath)) !== -1,
      ),
    );

    const result = new Set(
      (await Promise.all(paths.map(path => this._findConfigDir(path)))).filter(
        path => path != null,
      ),
    );
    // $FlowIssue Flow doesn't understand filter
    return (result: Set<NuclideUri>);
  }

  observeConfigs(): Observable<Set<NuclideUri>> {
    return this._currentConfigs.asObservable();
  }

  getOpenConfigs(): Set<NuclideUri> {
    return this._currentConfigs.getValue();
  }

  dispose(): void {
    this._subscription.unsubscribe();
    this._currentConfigs.complete();
    this._currentConfigs.unsubscribe();
  }
}
