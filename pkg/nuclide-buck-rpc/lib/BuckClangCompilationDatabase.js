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

import type {CompilationDatabaseParams} from '../../nuclide-buck/lib/types';
import type {BuckClangCompilationDatabase} from './types';

import {Observable} from 'rxjs';
import {SimpleCache} from 'nuclide-commons/SimpleCache';
import * as ClangService from '../../nuclide-clang-rpc';
import * as BuckService from './BuckServiceImpl';
import {getLogger} from 'log4js';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {guessBuildFile, isHeaderFile} from '../../nuclide-clang-rpc/lib/utils';

const logger = getLogger('nuclide-buck');
const BUCK_TIMEOUT = 10 * 60 * 1000;
const TARGET_KIND_REGEX = [
  'apple_binary',
  'apple_library',
  'apple_test',
  'cxx_binary',
  'cxx_library',
  'cxx_test',
].join('|');

/**
 * Facebook puts all headers in a <target>:__default_headers__ build target by default.
 * This target will never produce compilation flags, so make sure to ignore it.
 */
const DEFAULT_HEADERS_TARGET = '__default_headers__';

class BuckClangCompilationDatabaseHandler {
  _targetCache = new SimpleCache({keyFactory: JSON.stringify});
  _sourceCache = new SimpleCache();
  // Ensure that we can clear targetCache for a given file.
  _sourceToTargetKey = new Map();
  _params: CompilationDatabaseParams;

  constructor(params: CompilationDatabaseParams) {
    this._params = params;
  }

  resetForSource(src: string): void {
    this._sourceCache.delete(src);
    const targetKey = this._sourceToTargetKey.get(src);
    if (targetKey != null) {
      this._targetCache.delete(targetKey);
      this._sourceToTargetKey.delete(src);
    }
  }

  reset(): void {
    this._sourceCache.clear();
    this._targetCache.clear();
    this._sourceToTargetKey.clear();
  }

  getCompilationDatabase(
    file: string,
  ): Observable<?BuckClangCompilationDatabase> {
    return this._sourceCache.getOrCreate(file, () => {
      if (isHeaderFile(file)) {
        return Observable.fromPromise(
          ClangService.getRelatedSourceOrHeader(file),
        ).switchMap(source => {
          if (source != null) {
            logger.info(
              `${file} is a header, thus using ${source} for getting the compilation flags.`,
            );
            return this.getCompilationDatabase(source);
          } else {
            logger.error(
              `Couldn't find a corresponding source file for ${file}, thus there are no compilation flags available.`,
            );
            return Observable.fromPromise(guessBuildFile(file))
              .map(flagsFile => ({
                file: null,
                flagsFile,
                libclangPath: null,
                warnings: [
                  `I could not find a corresponding source file for ${file}.`,
                ],
              }))
              .publishLast()
              .refCount();
          }
        });
      } else {
        return this._getCompilationDatabase(file)
          .publishLast()
          .refCount();
      }
    });
  }

  _getCompilationDatabase(
    file: string,
  ): Observable<?BuckClangCompilationDatabase> {
    return Observable.fromPromise(BuckService.getRootForPath(file)).switchMap(
      buckRoot =>
        this._loadCompilationDatabaseFromBuck(file, buckRoot)
          .catch(err => {
            logger.error('Error getting flags from Buck for file ', file, err);
            throw err;
          })
          .do(db => {
            if (db != null) {
              this._cacheFilesToCompilationDB(db);
            }
          }),
    );
  }

  _loadCompilationDatabaseFromBuck(
    src: string,
    buckRoot: ?string,
  ): Observable<?BuckClangCompilationDatabase> {
    if (buckRoot == null) {
      return Observable.of(null);
    }
    return (this._params.args.length === 0
      ? Observable.fromPromise(BuckService._getPreferredArgsForRepo(buckRoot))
      : Observable.of(this._params.args)
    ).switchMap(extraArgs => {
      return Observable.fromPromise(
        BuckService.getOwners(
          buckRoot,
          src,
          extraArgs,
          TARGET_KIND_REGEX,
          false,
        ),
      )
        .map(owners =>
          owners.filter(x => x.indexOf(DEFAULT_HEADERS_TARGET) === -1),
        )
        .map(owners => {
          // Deprioritize Android-related targets because they build with gcc and
          // require gcc intrinsics that cause libclang to throw bad diagnostics.
          owners.sort((a, b) => {
            const aAndroid = a.endsWith('Android');
            const bAndroid = b.endsWith('Android');
            if (aAndroid && !bAndroid) {
              return 1;
            } else if (!aAndroid && bAndroid) {
              return -1;
            } else {
              return 0;
            }
          });
          return owners[0];
        })
        .switchMap(target => {
          if (target == null) {
            // Even if we can't get flags, return a flagsFile to watch
            return Observable.fromPromise(guessBuildFile(src)).map(
              flagsFile =>
                flagsFile != null
                  ? {
                      file: null,
                      flagsFile,
                      libclangPath: null,
                      warnings: [
                        `I could not find owner target of ${src}`,
                        `Is there an error in ${flagsFile}?`,
                      ],
                    }
                  : null,
            );
          } else {
            this._sourceToTargetKey.set(
              src,
              this._targetCache.keyForArgs([buckRoot, target, extraArgs]),
            );

            return this._targetCache.getOrCreate(
              [buckRoot, target, extraArgs],
              () =>
                this._loadCompilationDatabaseForBuckTarget(
                  buckRoot,
                  target,
                  extraArgs,
                )
                  .publishLast()
                  .refCount(),
            );
          }
        })
        .catch(err => {
          logger.error('Failed getting the target from buck', err);
          return Observable.of(null);
        });
    });
  }

  _loadCompilationDatabaseForBuckTarget(
    buckProjectRoot: string,
    target: string,
    extraArgs: Array<string>,
  ): Observable<BuckClangCompilationDatabase> {
    const flavors = ['compilation-database', ...this._params.flavorsForTarget];
    return (this._params.useDefaultPlatform
      ? Observable.fromPromise(
          BuckService.getDefaultPlatform(
            buckProjectRoot,
            target,
            extraArgs,
            false,
          ),
        ).map(platform => flavors.concat([platform]))
      : Observable.of(flavors)
    )
      .map(allFlavors => target + '#' + allFlavors.join(','))
      .switchMap(buildTarget => {
        return BuckService.build(
          buckProjectRoot,
          [
            // Small builds, like those used for a compilation database, can degrade overall
            // `buck build` performance by unnecessarily invalidating the Action Graph cache.
            // See https://buckbuild.com/concept/buckconfig.html#client.skip-action-graph-cache
            // for details on the importance of using skip-action-graph-cache=true.
            '--config',
            'client.skip-action-graph-cache=true',

            buildTarget,
            ...extraArgs,
            // TODO(hansonw): Any alternative to doing this?
            // '-L',
            // String(os.cpus().length / 2),
          ],
          {commandOptions: {timeout: BUCK_TIMEOUT}},
        ).switchMap(buildReport => {
          if (!buildReport.success) {
            const error = new Error(`Failed to build ${buildTarget}`);
            logger.error(error);
            throw error;
          }
          const firstResult = Object.keys(buildReport.results)[0];
          let pathToCompilationDatabase =
            buildReport.results[firstResult].output;
          pathToCompilationDatabase = nuclideUri.join(
            buckProjectRoot,
            pathToCompilationDatabase,
          );
          return Observable.fromPromise(
            BuckService.getBuildFile(buckProjectRoot, target, extraArgs),
          ).switchMap(buildFile =>
            Observable.fromPromise(
              this._processCompilationDb(
                {
                  file: pathToCompilationDatabase,
                  flagsFile: buildFile,
                  libclangPath: null,
                  target,
                  warnings: [],
                },
                buckProjectRoot,
                extraArgs,
              ),
            ),
          );
        });
      });
  }

  async _processCompilationDb(
    db: BuckClangCompilationDatabase,
    buckRoot: string,
    args: string[],
  ): Promise<BuckClangCompilationDatabase> {
    try {
      // $FlowFB
      const {createOmCompilationDb} = require('./fb/omCompilationDb');
      return await createOmCompilationDb(db, buckRoot, args);
    } catch (e) {}
    return db;
  }

  async _cacheFilesToCompilationDB(
    db: BuckClangCompilationDatabase,
  ): Promise<void> {
    const {file} = db;
    if (file == null) {
      return;
    }
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line nuclide-internal/unused-subscription
      ClangService.loadFilesFromCompilationDatabaseAndCacheThem(
        file,
        db.flagsFile,
      )
        .refCount()
        .subscribe(
          path => this._sourceCache.set(path, Observable.of(db)),
          reject, // on error
          resolve, // on complete
        );
    });
  }
}

const compilationDatabaseHandlerCache = new SimpleCache({
  keyFactory: (params: CompilationDatabaseParams) => JSON.stringify(params),
});

export function getCompilationDatabaseHandler(
  params: CompilationDatabaseParams,
): BuckClangCompilationDatabaseHandler {
  return compilationDatabaseHandlerCache.getOrCreate(
    params,
    () => new BuckClangCompilationDatabaseHandler(params),
  );
}
