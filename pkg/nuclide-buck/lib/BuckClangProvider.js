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

import type {
  ClangCompilationDatabase,
  ClangRequestSettings,
} from '../../nuclide-clang-rpc/lib/rpc-types';
import type {ClangConfigurationProvider} from '../../nuclide-clang/lib/types';
import type {BusySignalService} from 'atom-ide-ui';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {CompilationDatabaseParams} from './types';

import {getBuckServiceByNuclideUri} from '../../nuclide-remote-connection';
import {Cache} from '../../commons-node/cache';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {BuckTaskRunner} from './BuckTaskRunner';
import {ClangFlagsFileWatcher} from '../../nuclide-clang-base/lib/ClangFlagsFileWatcher';

class Provider {
  _projectRootCache: Cache<string, Promise<?string>> = new Cache();
  _compilationDBCache: Cache<
    string,
    Promise<?ClangCompilationDatabase>,
  > = new Cache();
  _host: NuclideUri;
  _params: CompilationDatabaseParams;
  _flagsFileWatcher: ClangFlagsFileWatcher;

  constructor(host: NuclideUri, params: CompilationDatabaseParams) {
    this._host = host;
    this._flagsFileWatcher = new ClangFlagsFileWatcher(host);
    this._params = params;
  }

  _reportCompilationDBBusySignalWhile(
    src: string,
    getBusySignalService: () => ?BusySignalService,
    dbPromise: Promise<?ClangCompilationDatabase>,
  ): Promise<?ClangCompilationDatabase> {
    const busySignal = getBusySignalService();
    return busySignal == null
      ? dbPromise
      : busySignal.reportBusyWhile(
          'Generating Buck compilation database for "' +
            nuclideUri.basename(src) +
            '"',
          () => dbPromise,
          {onlyForFile: src},
        );
  }

  getCompilationDatabase(
    src: string,
    getBusySignalService: () => ?BusySignalService,
  ): Promise<?ClangCompilationDatabase> {
    return this._compilationDBCache.getOrCreate(src, () => {
      return this._reportCompilationDBBusySignalWhile(
        src,
        getBusySignalService,
        getBuckServiceByNuclideUri(this._host)
          .getCompilationDatabase(src, this._params)
          .refCount()
          .do(db => {
            if (db != null && db.flagsFile != null) {
              this._flagsFileWatcher.watch(db.flagsFile, src, () =>
                this.resetForSource(src),
              );
            }
          })
          .toPromise(),
      );
    });
  }

  getProjectRoot(src: string): Promise<?string> {
    return this._projectRootCache.getOrCreate(src, () =>
      getBuckServiceByNuclideUri(this._host).getRootForPath(src),
    );
  }

  resetForSource(src: string): void {
    this._compilationDBCache.delete(src);
    getBuckServiceByNuclideUri(this._host).resetCompilationDatabaseForSource(
      src,
      this._params,
    );
    this._flagsFileWatcher.resetForSource(src);
  }

  reset(): void {
    this._compilationDBCache.clear();
    getBuckServiceByNuclideUri(this._host).resetCompilationDatabase(
      this._params,
    );
    this._flagsFileWatcher.reset();
  }
}

const providersCache = new Cache({
  keyFactory: ([host, params: CompilationDatabaseParams]) =>
    JSON.stringify([nuclideUri.getHostnameOpt(host) || '', params]),
  dispose: provider => provider.reset(),
});

function getProvider(
  host: NuclideUri,
  params: CompilationDatabaseParams,
): Provider {
  return providersCache.getOrCreate(
    [host, params],
    () => new Provider(host, params),
  );
}

const supportsSourceCache: Cache<string, Promise<boolean>> = new Cache();

export function getClangProvider(
  taskRunner: BuckTaskRunner,
  getBusySignalService: () => ?BusySignalService,
): ClangConfigurationProvider {
  return {
    async supportsSource(src: string): Promise<boolean> {
      return supportsSourceCache.getOrCreate(
        src,
        async () =>
          (await getBuckServiceByNuclideUri(src).getRootForPath(src)) != null,
      );
    },
    async getSettings(src: string): Promise<?ClangRequestSettings> {
      const params = taskRunner.getCompilationDatabaseParamsForCurrentContext();
      const provider = getProvider(src, params);
      const [compilationDatabase, projectRoot] = await Promise.all([
        provider.getCompilationDatabase(src, getBusySignalService),
        provider.getProjectRoot(src),
      ]);
      if (projectRoot == null) {
        return null;
      }
      return {
        projectRoot,
        compilationDatabase,
      };
    },
    resetForSource(src: string): void {
      const params = taskRunner.getCompilationDatabaseParamsForCurrentContext();
      getProvider(src, params).resetForSource(src);
      supportsSourceCache.delete(src);
    },
    reset(src: string): void {
      const params = taskRunner.getCompilationDatabaseParamsForCurrentContext();
      providersCache.delete([src, params]);
      supportsSourceCache.clear();
    },
    priority: 100,
  };
}
