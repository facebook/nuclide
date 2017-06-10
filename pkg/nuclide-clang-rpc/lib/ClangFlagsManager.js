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

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {shellParse} from 'nuclide-commons/string';
import {Observable} from 'rxjs';
import {trackTiming} from '../../nuclide-analytics';
import fsPromise from 'nuclide-commons/fsPromise';
import {getLogger} from 'log4js';
import * as BuckService from '../../nuclide-buck-rpc';
import {mapPathsInFlags} from './clang-flags-parser';
import {
  isHeaderFile,
  isSourceFile,
  findIncludingSourceFile,
  commonPrefix,
} from './utils';

const logger = getLogger('nuclide-clang-rpc');

const BUCK_TIMEOUT = 10 * 60 * 1000;

const COMPILATION_DATABASE_FILE = 'compile_commands.json';
const PROJECT_CLANG_FLAGS_FILE = '.nuclide_clang_config.json';

/**
 * Facebook puts all headers in a <target>:__default_headers__ build target by default.
 * This target will never produce compilation flags, so make sure to ignore it.
 */
const DEFAULT_HEADERS_TARGET = '__default_headers__';

const TARGET_KIND_REGEX = [
  'apple_binary',
  'apple_library',
  'apple_test',
  'cxx_binary',
  'cxx_library',
  'cxx_test',
].join('|');

const INCLUDE_SEARCH_TIMEOUT = 15000;

export type ClangFlags = {
  // Will be computed and memoized from rawData on demand.
  flags?: ?Array<string>,
  rawData: ?{
    flags: Array<string> | string,
    file: string,
    directory: string,
  },
  flagsFile: ?string,
};

type ClangProjectFlags = {
  extraCompilerFlags: Array<string>,
  ignoredCompilerFlags: Array<string>,
};

let _customFlags;
function getCustomFlags() {
  if (_customFlags !== undefined) {
    return _customFlags;
  }
  try {
    // $FlowFB
    _customFlags = require('./fb/custom-flags');
  } catch (e) {
    _customFlags = null;
  }
  return _customFlags;
}

function overrideIncludePath(src: string): string {
  const customFlags = getCustomFlags();
  if (customFlags != null) {
    return customFlags.overrideIncludePath(src);
  }
  return src;
}

function customizeBuckTarget(
  root: string,
  target: string,
): Promise<Array<string>> {
  const customFlags = getCustomFlags();
  if (customFlags != null) {
    return customFlags.customizeBuckTarget(root, target);
  }
  return Promise.resolve([target]);
}

export default class ClangFlagsManager {
  _cachedBuckFlags: Map<string, Promise<Map<string, ClangFlags>>>;
  _compilationDatabases: Map<string, Map<string, ClangFlags>>;
  _realpathCache: Object;
  _pathToFlags: Map<string, Promise<?ClangFlags>>;
  _clangProjectFlags: Map<string, Promise<?ClangProjectFlags>>;

  constructor() {
    this._pathToFlags = new Map();
    this._cachedBuckFlags = new Map();
    this._compilationDatabases = new Map();
    this._realpathCache = {};
    this._clangProjectFlags = new Map();
  }

  reset() {
    this._pathToFlags.clear();
    this._cachedBuckFlags.clear();
    this._compilationDatabases.clear();
    this._realpathCache = {};
    this._clangProjectFlags.clear();
  }

  /**
   * @return a space-delimited string of flags or null if nothing is known
   *     about the src file. For example, null will be returned if src is not
   *     under the project root.
   */
  async getFlagsForSrc(
    src: string,
    compilationDBFile: ?NuclideUri,
  ): Promise<?ClangFlags> {
    const data = await this._getFlagsForSrcCached(src, compilationDBFile);
    if (data == null) {
      return null;
    }
    if (data.flags === undefined) {
      const {rawData} = data;
      if (rawData == null) {
        data.flags = null;
      } else {
        let {flags} = rawData;
        if (typeof flags === 'string') {
          flags = shellParse(flags);
        }
        flags = await this._getModifiedFlags(src, flags);
        data.flags = ClangFlagsManager.sanitizeCommand(
          rawData.file,
          flags,
          rawData.directory,
        );
      }
    }
    return data;
  }

  _getFlagsForSrcCached(
    src: string,
    compilationDBFile: ?NuclideUri,
  ): Promise<?ClangFlags> {
    const cacheKey = `${src}-${compilationDBFile || ''}`;
    let cached = this._pathToFlags.get(cacheKey);
    if (cached == null) {
      cached = this._getFlagsForSrcImpl(src, compilationDBFile);
      this._pathToFlags.set(cacheKey, cached);
    }
    return cached;
  }

  _getFlagsForSrcImpl(
    src: string,
    compilationDBFile: ?NuclideUri,
  ): Promise<?ClangFlags> {
    return trackTiming('nuclide-clang.get-flags', () =>
      this.__getFlagsForSrcImpl(src, compilationDBFile),
    );
  }

  _findSourceFileForHeaderFromCompilationDatabase(
    header: string,
    dbFlags: Map<string, ClangFlags>,
  ): ?string {
    const basename = ClangFlagsManager._getFileBasename(header);
    const inferredSrcs = Array.from(dbFlags.keys())
      .filter(
        path =>
          ClangFlagsManager._getFileBasename(path) === basename &&
          isSourceFile(path),
      )
      .map(path => {
        return {score: commonPrefix(path, header), path};
      })
      .sort((a, b) => b.score - a.score); // prefer bigger matches
    if (inferredSrcs.length > 0) {
      return inferredSrcs[0].path;
    }
    return null;
  }

  _getXFlagForSourceFile(sourceFile: string): string {
    const ext = nuclideUri.extname(sourceFile);
    if (ext === '.mm') {
      return 'objective-c++';
    } else if (ext === '.m') {
      return 'objective-c';
    } else if (ext === '.c') {
      return 'c';
    } else {
      return 'c++';
    }
  }

  async _getFlagsFromSourceFileForHeader(
    sourceFile: string,
    compilationDBFile: ?NuclideUri,
  ): Promise<?ClangFlags> {
    const data = await this._getFlagsForSrcCached(
      sourceFile,
      compilationDBFile,
    );
    if (data != null) {
      const {rawData} = data;
      if (rawData != null) {
        const xFlag = this._getXFlagForSourceFile(sourceFile);
        let {flags} = rawData;
        if (typeof flags === 'string') {
          if (!flags.includes('-x ')) {
            flags += ` -x ${xFlag}`;
            rawData.flags = flags;
          }
        } else {
          if (flags.find(s => s === '-x') === undefined) {
            rawData.flags = flags.concat(['-x', xFlag]);
          }
        }
      }
    }
    return data;
  }

  async _getModifiedFlags(
    src: string,
    originalFlags: Array<string>,
  ): Promise<Array<string>> {
    // Look for the project-wide flags
    const projectFlagsDir = await fsPromise.findNearestFile(
      PROJECT_CLANG_FLAGS_FILE,
      nuclideUri.dirname(src),
    );
    if (projectFlagsDir == null) {
      return originalFlags;
    }
    const projectFlagsFile = nuclideUri.join(
      projectFlagsDir,
      PROJECT_CLANG_FLAGS_FILE,
    );
    const projectFlags = await this._loadProjectCompilerFlags(projectFlagsFile);
    if (projectFlags == null) {
      return originalFlags;
    }

    return originalFlags
      .filter(flag => projectFlags.ignoredCompilerFlags.indexOf(flag) === -1)
      .concat(projectFlags.extraCompilerFlags);
  }

  async _getDBFlagsAndDirForSrc(
    src: string,
    compilationDBFile: ?NuclideUri,
  ): Promise<{
    dbFlags: ?Map<string, ClangFlags>,
    dbDir: ?string,
  }> {
    let dbFlags = null;
    let dbDir = null;
    if (compilationDBFile != null) {
      // Look for a compilation database provided by the client.
      dbFlags = await this._loadFlagsFromCompilationDatabase(compilationDBFile);
      dbDir = nuclideUri.dirname(compilationDBFile);
    } else {
      // Look for a manually provided compilation database.
      dbDir = await fsPromise.findNearestFile(
        COMPILATION_DATABASE_FILE,
        nuclideUri.dirname(src),
      );
      if (dbDir != null) {
        const dbFile = nuclideUri.join(dbDir, COMPILATION_DATABASE_FILE);
        dbFlags = await this._loadFlagsFromCompilationDatabase(dbFile);
      }
    }
    return {dbFlags, dbDir};
  }

  async _getRelatedSrcFileForHeader(
    src: string,
    dbFlags: ?Map<string, ClangFlags>,
    dbDir: ?string,
  ): Promise<?string> {
    if (dbFlags != null) {
      const sourceFile = this._findSourceFileForHeaderFromCompilationDatabase(
        src,
        dbFlags,
      );
      if (sourceFile != null) {
        return sourceFile;
      }
    }
    // Try finding flags for a related source file.
    const projectRoot = (await BuckService.getRootForPath(src)) || dbDir;
    // If we don't have a .buckconfig or a compile_commands.json, we won't find flags regardless.
    if (projectRoot != null) {
      return ClangFlagsManager._findSourceFileForHeader(src, projectRoot);
    }
    return null;
  }

  async _getFlagsForSrcImplFromBuck(src: string): Promise<?ClangFlags> {
    const buckFlags = await this._loadFlagsFromBuck(src).catch(err => {
      logger.error('Error getting flags from Buck', err);
      return new Map();
    });
    if (isHeaderFile(src)) {
      // Accept flags from any source file in the target.
      if (buckFlags.size > 0) {
        return buckFlags.values().next().value;
      }
    }
    const flags = buckFlags.get(src);
    if (flags != null) {
      return flags;
    }
  }

  async getRelatedSrcFileForHeader(
    src: string,
    compilationDBFile: ?NuclideUri,
  ): Promise<?string> {
    const {dbFlags, dbDir} = await this._getDBFlagsAndDirForSrc(
      src,
      compilationDBFile,
    );
    return this._getRelatedSrcFileForHeader(src, dbFlags, dbDir);
  }

  async __getFlagsForSrcImpl(
    src: string,
    compilationDBFile: ?NuclideUri,
  ): Promise<?ClangFlags> {
    const {dbFlags, dbDir} = await this._getDBFlagsAndDirForSrc(
      src,
      compilationDBFile,
    );
    if (dbFlags != null) {
      const flags = dbFlags.get(src);
      if (flags != null) {
        return flags;
      }
    }

    if (isHeaderFile(src)) {
      const sourceFile = await this._getRelatedSrcFileForHeader(
        src,
        dbFlags,
        dbDir,
      );
      if (sourceFile != null) {
        return this._getFlagsFromSourceFileForHeader(
          sourceFile,
          compilationDBFile,
        );
      }
    }

    const flagsFromBuck = await this._getFlagsForSrcImplFromBuck(src);
    if (flagsFromBuck != null) {
      return flagsFromBuck;
    }

    // Even if we can't get flags, try to watch the build file in case they get added.
    const buildFile = await ClangFlagsManager._guessBuildFile(src);
    if (buildFile != null) {
      return {
        rawData: null,
        flagsFile: buildFile,
      };
    }

    return null;
  }

  async _loadProjectCompilerFlags(
    flagsFile: string,
  ): Promise<?ClangProjectFlags> {
    let cached = this._clangProjectFlags.get(flagsFile);
    if (cached == null) {
      cached = this._loadProjectCompilerFlagsImpl(flagsFile);
      this._clangProjectFlags.set(flagsFile, cached);
    }
    return cached;
  }

  async _loadProjectCompilerFlagsImpl(
    flagsFile: string,
  ): Promise<?ClangProjectFlags> {
    let result = null;
    try {
      const contents = await fsPromise.readFile(flagsFile, 'utf8');
      const data = JSON.parse(contents);
      invariant(data instanceof Object);
      const {extra_compiler_flags, ignored_compiler_flags} = data;
      const extraCompilerFlags = [];
      const ignoredCompilerFlags = [];

      if (extra_compiler_flags != null) {
        extra_compiler_flags.forEach(flag => extraCompilerFlags.push(flag));
      }
      if (ignored_compiler_flags != null) {
        ignored_compiler_flags.forEach(flag => ignoredCompilerFlags.push(flag));
      }
      result = {extraCompilerFlags, ignoredCompilerFlags};
    } catch (e) {
      logger.error(`Error reading compilation flags from ${flagsFile}`, e);
    }

    return result;
  }

  async _loadFlagsFromCompilationDatabase(
    dbFile: string,
  ): Promise<Map<string, ClangFlags>> {
    const cache = this._compilationDatabases.get(dbFile);
    if (cache != null) {
      return cache;
    }

    const flags = new Map();
    try {
      const contents = await fsPromise.readFile(dbFile, 'utf8');
      const data = JSON.parse(contents);
      invariant(data instanceof Array);
      const dbDir = nuclideUri.dirname(dbFile);
      await Promise.all(
        data.map(async entry => {
          const {command, file} = entry;
          const directory = await fsPromise.realpath(
            // Relative directories aren't part of the spec, but resolving them
            // relative to the compile_commands.json location seems reasonable.
            nuclideUri.resolve(dbDir, entry.directory),
            this._realpathCache,
          );
          const filename = nuclideUri.resolve(directory, file);
          if (await fsPromise.exists(filename)) {
            const realpath = await fsPromise.realpath(
              filename,
              this._realpathCache,
            );
            const result = {
              rawData: {
                flags: command,
                file,
                directory,
              },
              flagsFile: dbFile,
            };
            flags.set(realpath, result);
            this._pathToFlags.set(realpath, Promise.resolve(result));
          }
        }),
      );
      this._compilationDatabases.set(dbFile, flags);
    } catch (e) {
      logger.error(`Error reading compilation flags from ${dbFile}`, e);
    }
    return flags;
  }

  async _loadFlagsFromBuck(src: string): Promise<Map<string, ClangFlags>> {
    const buckRoot = await BuckService.getRootForPath(src);
    if (buckRoot == null) {
      return new Map();
    }

    const target = (await BuckService.getOwners(
      buckRoot,
      src,
      TARGET_KIND_REGEX,
    )).find(x => x.indexOf(DEFAULT_HEADERS_TARGET) === -1);

    if (target == null) {
      return new Map();
    }

    const key = buckRoot + ':' + target;
    let cached = this._cachedBuckFlags.get(key);
    if (cached != null) {
      return cached;
    }
    cached = this._loadFlagsForBuckTarget(buckRoot, target);
    this._cachedBuckFlags.set(key, cached);
    return cached;
  }

  async _loadFlagsForBuckTarget(
    buckProjectRoot: string,
    target: string,
  ): Promise<Map<string, ClangFlags>> {
    // TODO(t12973165): Allow configuring a custom flavor.
    // For now, this seems to use cxx.default_platform, which tends to be correct.
    const buildTarget = target + '#compilation-database';
    const buildReport = await BuckService.build(
      buckProjectRoot,
      [
        // Small builds, like those used for a compilation database, can degrade overall
        // `buck build` performance by unnecessarily invalidating the Action Graph cache.
        // See https://buckbuild.com/concept/buckconfig.html#client.skip-action-graph-cache
        // for details on the importance of using skip-action-graph-cache=true.
        '--config',
        'client.skip-action-graph-cache=true',

        ...(await customizeBuckTarget(buckProjectRoot, buildTarget)),
        // TODO(hansonw): Any alternative to doing this?
        // '-L',
        // String(os.cpus().length / 2),
      ],
      {commandOptions: {timeout: BUCK_TIMEOUT}},
    );
    if (!buildReport.success) {
      const error = `Failed to build ${buildTarget}`;
      logger.error(error);
      throw error;
    }
    const firstResult = Object.keys(buildReport.results)[0];
    let pathToCompilationDatabase = buildReport.results[firstResult].output;
    pathToCompilationDatabase = nuclideUri.join(
      buckProjectRoot,
      pathToCompilationDatabase,
    );

    const compilationDatabase = JSON.parse(
      await fsPromise.readFile(pathToCompilationDatabase, 'utf8'),
    );

    const flags = new Map();
    const buildFile = await BuckService.getBuildFile(buckProjectRoot, target);
    compilationDatabase.forEach(item => {
      const {file} = item;
      const result = {
        rawData: {
          flags: item.arguments,
          file,
          directory: buckProjectRoot,
        },
        flagsFile: buildFile,
      };
      flags.set(file, result);
      this._pathToFlags.set(file, Promise.resolve(result));
    });
    return flags;
  }

  // The file may be new. Look for a nearby BUCK or TARGETS file.
  static async _guessBuildFile(file: string): Promise<?string> {
    const dir = nuclideUri.dirname(file);
    let bestMatch = null;
    await Promise.all(
      ['BUCK', 'TARGETS', 'compile_commands.json'].map(async name => {
        const nearestDir = await fsPromise.findNearestFile(name, dir);
        if (nearestDir != null) {
          const match = nuclideUri.join(nearestDir, name);
          // Return the closest (most specific) match.
          if (bestMatch == null || match.length > bestMatch.length) {
            bestMatch = match;
          }
        }
      }),
    );
    return bestMatch;
  }

  static sanitizeCommand(
    sourceFile: string,
    args_: Array<string>,
    basePath: string,
  ): Array<string> {
    // Make a mutable copy.
    let args = [...args_];
    // For safety, create a new copy of the array. We exclude the path to the file to compile from
    // compilation database generated by Buck. It must be removed from the list of command-line
    // arguments passed to libclang.
    const normalizedSourceFile = nuclideUri.normalize(sourceFile);
    args = args.filter(
      arg =>
        normalizedSourceFile !== arg &&
        normalizedSourceFile !== nuclideUri.resolve(basePath, arg),
    );

    // Resolve relative path arguments against the Buck project root.
    args = mapPathsInFlags(args, path_ => {
      let path = overrideIncludePath(path_);
      if (!nuclideUri.isAbsolute(path)) {
        path = nuclideUri.join(basePath, path);
      }
      return path;
    });

    // If an output file is specified, remove that argument.
    const index = args.indexOf('-o');
    if (index !== -1) {
      args.splice(index, 2);
    }

    return args;
  }

  static async _findSourceFileForHeader(
    header: string,
    projectRoot: string,
  ): Promise<?string> {
    // Basic implementation: look at files in the same directory for paths
    // with matching file names.
    const dir = nuclideUri.dirname(header);
    const files = await fsPromise.readdir(dir);
    const basename = ClangFlagsManager._getFileBasename(header);
    for (const file of files) {
      if (
        isSourceFile(file) &&
        ClangFlagsManager._getFileBasename(file) === basename
      ) {
        return nuclideUri.join(dir, file);
      }
    }

    // Try searching all subdirectories for source files that include this header.
    // Give up after INCLUDE_SEARCH_TIMEOUT.
    return findIncludingSourceFile(header, projectRoot)
      .timeout(INCLUDE_SEARCH_TIMEOUT)
      .catch(() => Observable.of(null))
      .toPromise();
  }

  // Strip off the extension and conventional suffixes like "Internal" and "-inl".
  static _getFileBasename(file: string): string {
    let basename = nuclideUri.basename(file);
    const ext = basename.lastIndexOf('.');
    if (ext !== -1) {
      basename = basename.substr(0, ext);
    }
    return basename.replace(/(Internal|-inl)$/, '');
  }
}
