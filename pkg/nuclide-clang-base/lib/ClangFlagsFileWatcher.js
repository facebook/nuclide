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

import {Subscription} from 'rxjs';
import {Cache} from '../../commons-node/cache';
import SharedObservableCache from '../../commons-node/SharedObservableCache';
import {getFileWatcherServiceByNuclideUri} from '../../nuclide-remote-connection';

export class ClangFlagsFileWatcher {
  _flagsFileForSourceCache: Cache<string, string> = new Cache();
  _watchedFilesCache: Cache<string, Subscription> = new Cache({
    dispose: subscription => subscription.unsubscribe(),
  });
  _watchedFilesObservablesCache: SharedObservableCache<string, *>;

  constructor(host: string) {
    this._watchedFilesObservablesCache = new SharedObservableCache(buildFile =>
      getFileWatcherServiceByNuclideUri(host)
        .watchWithNode(buildFile)
        .refCount()
        .share()
        .take(1),
    );
  }

  watch(
    flagsFile: string,
    src: string,
    onChange: () => Promise<void> | void,
  ): void {
    const watchedFile = this._flagsFileForSourceCache.get(src);
    if (watchedFile != null) {
      return;
    }
    this._flagsFileForSourceCache.set(src, flagsFile);
    this._watchedFilesCache.set(
      src,
      this._watchedFilesObservablesCache.get(flagsFile).subscribe(() => {
        try {
          onChange();
        } catch (_) {}
      }),
    );
  }

  reset(): void {
    this._flagsFileForSourceCache.clear();
    this._watchedFilesCache.clear();
  }

  resetForSource(src: string): void {
    this._flagsFileForSourceCache.delete(src);
    this._watchedFilesCache.delete(src);
  }
}
