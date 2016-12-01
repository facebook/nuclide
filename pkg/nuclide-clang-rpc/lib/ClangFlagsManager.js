'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import invariant from 'assert';
import os from 'os';
import nuclideUri from '../../commons-node/nuclideUri';
import {shellParse} from '../../commons-node/string';
import {Observable} from 'rxjs';
import {trackTiming} from '../../nuclide-analytics';
import fsPromise from '../../commons-node/fsPromise';
import {getLogger} from '../../nuclide-logging';
import * as BuckService from '../../nuclide-buck-rpc';
import {isHeaderFile, isSourceFile, findIncludingSourceFile} from './utils';

const logger = getLogger();

const BUCK_TIMEOUT = 10 * 60 * 1000;

const COMPILATION_DATABASE_FILE = 'compile_commands.json';
/**
 * Facebook puts all headers in a <target>:__default_headers__ build target by default.
 * This target will never produce compilation flags, so make sure to ignore it.
 */
const DEFAULT_HEADERS_TARGET = '__default_headers__';

const CLANG_FLAGS_THAT_TAKE_PATHS = new Set([
  '-F',
  '-I',
  '-include',
  '-iquote',
  '-isysroot',
  '-isystem',
]);

const TARGET_KIND_REGEX = [
  'apple_binary',
  'apple_library',
  'apple_test',
  'cxx_binary',
  'cxx_library',
  'cxx_test',
].join('|');

const SINGLE_LETTER_CLANG_FLAGS_THAT_TAKE_PATHS = new Set(
  Array.from(CLANG_FLAGS_THAT_TAKE_PATHS)
    .filter(item => item.length === 2),
);

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

let _overrideIncludePath = undefined;
function overrideIncludePath(src: string): string {
  if (_overrideIncludePath === undefined) {
    _overrideIncludePath = null;
    try {
      // $FlowFB
      _overrideIncludePath = require('./fb/custom-flags').overrideIncludePath;
    } catch (e) {
      // open-source version
    }
  }
  if (_overrideIncludePath != null) {
    return _overrideIncludePath(src);
  }
  return src;
}

export default class ClangFlagsManager {
  _cachedBuckFlags: Map<string, Promise<Map<string, ClangFlags>>>;
  _compilationDatabases: Set<string>;
  _realpathCache: Object;
  _pathToFlags: Map<string, Promise<?ClangFlags>>;

  constructor() {
    this._pathToFlags = new Map();
    this._cachedBuckFlags = new Map();
    this._compilationDatabases = new Set();
    this._realpathCache = {};
  }

  reset() {
    this._pathToFlags.clear();
    this._cachedBuckFlags.clear();
    this._compilationDatabases.clear();
    this._realpathCache = {};
  }

  /**
   * @return a space-delimited string of flags or null if nothing is known
   *     about the src file. For example, null will be returned if src is not
   *     under the project root.
   */
  async getFlagsForSrc(src: string): Promise<?ClangFlags> {
    const data = await this._getFlagsForSrcCached(src);
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
        data.flags = ClangFlagsManager.sanitizeCommand(rawData.file, flags, rawData.directory);
      }
    }
    return data;
  }

  _getFlagsForSrcCached(src: string): Promise<?ClangFlags> {
    let cached = this._pathToFlags.get(src);
    if (cached == null) {
      cached = this._getFlagsForSrcImpl(src);
      this._pathToFlags.set(src, cached);
    }
    return cached;
  }

  _getFlagsForSrcImpl(src: string): Promise<?ClangFlags> {
    return trackTiming(
      'nuclide-clang.get-flags',
      () => this.__getFlagsForSrcImpl(src),
    );
  }

  async __getFlagsForSrcImpl(src: string): Promise<?ClangFlags> {
    // Look for a manually provided compilation database.
    const dbDir = await fsPromise.findNearestFile(
      COMPILATION_DATABASE_FILE,
      nuclideUri.dirname(src),
    );
    if (dbDir != null) {
      const dbFile = nuclideUri.join(dbDir, COMPILATION_DATABASE_FILE);
      const dbFlags = await this._loadFlagsFromCompilationDatabase(dbFile);
      const flags = dbFlags.get(src);
      if (flags != null) {
        return flags;
      }
    }

    const buckFlags = await this._loadFlagsFromBuck(src)
      .catch(err => {
        logger.error('Error getting flags from Buck', err);
        return new Map();
      });
    if (isHeaderFile(src)) {
      // Accept flags from any source file in the target.
      if (buckFlags.size > 0) {
        return buckFlags.values().next().value;
      }
      // Try finding flags for a related source file.
      const projectRoot = (await BuckService.getRootForPath(src)) || dbDir;
      // If we don't have a .buckconfig or a compile_commands.json, we won't find flags regardless.
      if (projectRoot == null) {
        return null;
      }
      const sourceFile = await ClangFlagsManager._findSourceFileForHeader(src, projectRoot);
      if (sourceFile != null) {
        return this._getFlagsForSrcCached(sourceFile);
      }
    }

    const flags = buckFlags.get(src);
    if (flags != null) {
      return flags;
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

  async _loadFlagsFromCompilationDatabase(dbFile: string): Promise<Map<string, ClangFlags>> {
    const flags = new Map();
    if (this._compilationDatabases.has(dbFile)) {
      return flags;
    }

    try {
      const contents = await fsPromise.readFile(dbFile, 'utf8');
      const data = JSON.parse(contents);
      invariant(data instanceof Array);
      const dbDir = nuclideUri.dirname(dbFile);
      await Promise.all(data.map(async entry => {
        const {command, file} = entry;
        const directory = await fsPromise.realpath(
          // Relative directories aren't part of the spec, but resolving them
          // relative to the compile_commands.json location seems reasonable.
          nuclideUri.resolve(dbDir, entry.directory),
          this._realpathCache,
        );
        const filename = nuclideUri.resolve(directory, file);
        if (await fsPromise.exists(filename)) {
          const realpath = await fsPromise.realpath(filename, this._realpathCache);
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
      }));
      this._compilationDatabases.add(dbFile);
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

    const target = (await BuckService.getOwners(buckRoot, src, TARGET_KIND_REGEX))
      .find(x => x.indexOf(DEFAULT_HEADERS_TARGET) === -1);

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
    // Since this is a background process, avoid stressing the system.
    const maxLoad = os.cpus().length / 2;
    const buildReport = await BuckService.build(
      buckProjectRoot,
      [buildTarget, '-L', String(maxLoad)],
      {commandOptions: {timeout: BUCK_TIMEOUT}},
    );
    if (!buildReport.success) {
      const error = `Failed to build ${buildTarget}`;
      logger.error(error);
      throw error;
    }
    let pathToCompilationDatabase = buildReport.results[buildTarget].output;
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
    await Promise.all(['BUCK', 'TARGETS', 'compile_commands.json'].map(async name => {
      const nearestDir = await fsPromise.findNearestFile(name, dir);
      if (nearestDir != null) {
        const match = nuclideUri.join(nearestDir, name);
        // Return the closest (most specific) match.
        if (bestMatch == null || match.length > bestMatch.length) {
          bestMatch = match;
        }
      }
    }));
    return bestMatch;
  }

  static sanitizeCommand(
    sourceFile: string,
    args_: Array<string>,
    basePath: string,
  ): Array<string> {
    // The first string is always the path to the compiler (g++, clang)
    let args = args_.slice(1);
    // For safety, create a new copy of the array. We exclude the path to the file to compile from
    // compilation database generated by Buck. It must be removed from the list of command-line
    // arguments passed to libclang.
    const normalizedSourceFile = nuclideUri.normalize(sourceFile);
    args = args.filter(arg =>
      normalizedSourceFile !== arg &&
      normalizedSourceFile !== nuclideUri.resolve(basePath, arg),
    );

    // Resolve relative path arguments against the Buck project root.
    args.forEach((arg, argIndex) => {
      if (CLANG_FLAGS_THAT_TAKE_PATHS.has(arg)) {
        const nextIndex = argIndex + 1;
        let filePath = overrideIncludePath(args[nextIndex]);
        if (!nuclideUri.isAbsolute(filePath)) {
          filePath = nuclideUri.join(basePath, filePath);
        }
        args[nextIndex] = filePath;
      } else if (SINGLE_LETTER_CLANG_FLAGS_THAT_TAKE_PATHS.has(arg.substring(0, 2))) {
        let filePath = overrideIncludePath(arg.substring(2));
        if (!nuclideUri.isAbsolute(filePath)) {
          filePath = nuclideUri.join(basePath, filePath);
        }
        args[argIndex] = arg.substring(0, 2) + filePath;
      }
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
      if (isSourceFile(file) && ClangFlagsManager._getFileBasename(file) === basename) {
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
