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

import type {ClangCompilationDatabase} from './rpc-types';

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
  guessBuildFile,
} from './utils';

const logger = getLogger('nuclide-clang-rpc');

const COMPILATION_DATABASE_FILE = 'compile_commands.json';
const PROJECT_CLANG_FLAGS_FILE = '.nuclide_clang_config.json';

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

export default class ClangFlagsManager {
  _compilationDatabases: Map<string, Map<string, ClangFlags>>;
  _realpathCache: Object;
  _pathToFlags: Map<string, Promise<?ClangFlags>>;
  _clangProjectFlags: Map<string, Promise<?ClangProjectFlags>>;

  constructor() {
    this._pathToFlags = new Map();
    this._compilationDatabases = new Map();
    this._realpathCache = {};
    this._clangProjectFlags = new Map();
  }

  reset() {
    this._pathToFlags.clear();
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
    compilationDB: ?ClangCompilationDatabase,
  ): Promise<?ClangFlags> {
    const data = await this._getFlagsForSrcCached(src, compilationDB);
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

  _cacheKeyForCompilationDatabase(
    compilationDB: ?ClangCompilationDatabase,
  ): string {
    return compilationDB == null
      ? ''
      : `${compilationDB.file || ''}-${compilationDB.flagsFile || ''}`;
  }

  _getFlagsForSrcCached(
    src: string,
    compilationDB: ?ClangCompilationDatabase,
  ): Promise<?ClangFlags> {
    const cacheKey = `${src}-${this._cacheKeyForCompilationDatabase(
      compilationDB,
    )}`;
    let cached = this._pathToFlags.get(cacheKey);
    if (cached == null) {
      cached = this._getFlagsForSrcImpl(src, compilationDB);
      this._pathToFlags.set(cacheKey, cached);
    }
    return cached;
  }

  _getFlagsForSrcImpl(
    src: string,
    compilationDB: ?ClangCompilationDatabase,
  ): Promise<?ClangFlags> {
    return trackTiming('nuclide-clang.get-flags', () =>
      this.__getFlagsForSrcImpl(src, compilationDB),
    );
  }

  _findSourceFileForHeaderFromCompilationDatabase(
    header: string,
    dbFlags: Map<string, ClangFlags>,
  ): ?string {
    const basename = ClangFlagsManager._getFileBasename(header);
    const srcWithSameBasename = [];
    const otherSrcs = [];
    for (const path of dbFlags.keys()) {
      if (
        ClangFlagsManager._getFileBasename(path) === basename &&
        isSourceFile(path)
      ) {
        srcWithSameBasename.push({
          score: commonPrefix(path, header),
          path,
        });
      } else {
        otherSrcs.push({
          score: commonPrefix(path, header),
          path,
        });
      }
    }
    const sortSrcs = srcs => srcs.sort((a, b) => b.score - a.score); // prefer bigger matches
    if (srcWithSameBasename.length > 0) {
      return sortSrcs(srcWithSameBasename)[0].path;
    }
    if (otherSrcs.length > 0) {
      return sortSrcs(otherSrcs)[0].path;
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
    compilationDB: ?ClangCompilationDatabase,
  ): Promise<?ClangFlags> {
    const data = await this._getFlagsForSrcCached(sourceFile, compilationDB);
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
    compilationDB: ?ClangCompilationDatabase,
  ): Promise<{
    dbFlags: ?Map<string, ClangFlags>,
    dbDir: ?string,
  }> {
    let dbFlags = null;
    let dbDir = null;
    if (compilationDB != null && compilationDB.file != null) {
      // Look for a compilation database provided by the client.
      dbDir = nuclideUri.dirname(compilationDB.file);
      dbFlags = await this._loadFlagsFromCompilationDatabase(compilationDB);
    } else {
      // Look for a manually provided compilation database.
      dbDir = await fsPromise.findNearestFile(
        COMPILATION_DATABASE_FILE,
        nuclideUri.dirname(src),
      );
      if (dbDir != null) {
        const dbFile = nuclideUri.join(dbDir, COMPILATION_DATABASE_FILE);
        dbFlags = await this._loadFlagsFromCompilationDatabase({
          file: dbFile,
          flagsFile: null,
          libclangPath: null,
        });
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

  async getRelatedSrcFileForHeader(
    src: string,
    compilationDB: ?ClangCompilationDatabase,
  ): Promise<?string> {
    const {dbFlags, dbDir} = await this._getDBFlagsAndDirForSrc(
      src,
      compilationDB,
    );
    return this._getRelatedSrcFileForHeader(src, dbFlags, dbDir);
  }

  async __getFlagsForSrcImpl(
    src: string,
    compilationDB: ?ClangCompilationDatabase,
  ): Promise<?ClangFlags> {
    const {dbFlags, dbDir} = await this._getDBFlagsAndDirForSrc(
      src,
      compilationDB,
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
        return this._getFlagsFromSourceFileForHeader(sourceFile, compilationDB);
      }
    }

    // Even if we can't get flags, try to watch the build file in case they get added.
    const buildFile =
      compilationDB != null && compilationDB.flagsFile != null
        ? compilationDB.flagsFile
        : await guessBuildFile(src);
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
    db: ClangCompilationDatabase,
  ): Promise<Map<string, ClangFlags>> {
    if (db.file == null) {
      return new Map();
    }
    const dbFile = db.file;
    const key = this._cacheKeyForCompilationDatabase(db);
    const cache = this._compilationDatabases.get(key);
    if (cache != null) {
      return cache;
    }

    const flags = new Map();
    try {
      const contents = await fsPromise.readFile(dbFile, 'utf8');
      const data = JSON.parse(contents);
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
            // Buck sends the flags in the arguments section. We use it if it was correctly parsed
            // by JSON.parse. The command section emitted by buck is not a valid json expression nor
            // can be parsed by shellParse.
            const result = {
              rawData: {
                flags: Array.isArray(entry.arguments)
                  ? entry.arguments
                  : command,
                file,
                directory,
              },
              flagsFile: db.flagsFile || db.file,
            };
            flags.set(realpath, result);
            this._pathToFlags.set(realpath, Promise.resolve(result));
          }
        }),
      );
      this._compilationDatabases.set(key, flags);
    } catch (e) {
      logger.error(`Error reading compilation flags from ${dbFile}`, e);
    }
    return flags;
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
