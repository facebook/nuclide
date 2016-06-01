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
import fs from 'fs';
import os from 'os';
import path from 'path';
import {Observable} from 'rxjs';
import {parse} from 'shell-quote';
import {trackTiming} from '../../nuclide-analytics';
import fsPromise from '../../commons-node/fsPromise';
import {getLogger} from '../../nuclide-logging';
import {BuckProject} from '../../nuclide-buck-base';
import {isHeaderFile, isSourceFile, findIncludingSourceFile} from './utils';

const logger = getLogger();

const BUCK_TIMEOUT = 60000;

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

const SINGLE_LETTER_CLANG_FLAGS_THAT_TAKE_PATHS = new Set(
  Array.from(CLANG_FLAGS_THAT_TAKE_PATHS)
    .filter(item => item.length === 2)
);

const INCLUDE_SEARCH_TIMEOUT = 15000;

export type ClangFlags = {
  flags: ?Array<string>;
  // Emits file change events for the underlying flags file.
  // (rename, change)
  changes: Observable<string>;
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

class ClangFlagsManager {
  _cachedBuckProjects: Map<string, BuckProject>;
  _compilationDatabases: Set<string>;
  _realpathCache: Object;
  pathToFlags: Map<string, ?ClangFlags>;

  // Watch config files (TARGETS/BUCK/compile_commands.json) for changes.
  _flagFileObservables: Map<string, Observable<string>>;

  constructor() {
    this.pathToFlags = new Map();
    this._cachedBuckProjects = new Map();
    this._compilationDatabases = new Set();
    this._realpathCache = {};
    this._flagFileObservables = new Map();
  }

  reset() {
    this.pathToFlags.clear();
    this._cachedBuckProjects.clear();
    this._compilationDatabases.clear();
    this._realpathCache = {};
    this._flagFileObservables.clear();
  }

  async _getBuckProject(src: string): Promise<?BuckProject> {
    // For now, if a user requests the flags for a path outside of a Buck project,
    // such as /Applications/Xcode.app/Contents/Developer/Platforms/..., then
    // return null. Going forward, we probably want to special-case some of the
    // paths under /Applications/Xcode.app so that click-to-symbol works in
    // files like Frameworks/UIKit.framework/Headers/UIImage.h.
    const buckProjectRoot = await BuckProject.getRootForPath(src);
    if (buckProjectRoot == null) {
      logger.info(
          'Did not try to attempt to get flags from Buck because ' +
          'source file %s does not appear to be part of a Buck project.',
          src);
      return null;
    }

    if (this._cachedBuckProjects.has(buckProjectRoot)) {
      return this._cachedBuckProjects.get(buckProjectRoot);
    }

    const buckProject = new BuckProject({rootPath: buckProjectRoot});
    this._cachedBuckProjects.set(buckProjectRoot, buckProject);
    return buckProject;
  }

  /**
   * @return a space-delimited string of flags or null if nothing is known
   *     about the src file. For example, null will be returned if src is not
   *     under the project root.
   */
  async getFlagsForSrc(src: string): Promise<?ClangFlags> {
    let flags = this.pathToFlags.get(src);
    if (flags !== undefined) {
      return flags;
    }
    flags = await this._getFlagsForSrcImpl(src);
    this.pathToFlags.set(src, flags);
    return flags;
  }

  @trackTiming('nuclide-clang.get-flags')
  async _getFlagsForSrcImpl(src: string): Promise<?ClangFlags> {
    // Look for a manually provided compilation database.
    const dbDir = await fsPromise.findNearestFile(
      COMPILATION_DATABASE_FILE,
      path.dirname(src),
    );
    if (dbDir != null) {
      const dbFile = path.join(dbDir, COMPILATION_DATABASE_FILE);
      await this._loadFlagsFromCompilationDatabase(dbFile);
      const flags = this.pathToFlags.get(src);
      if (flags != null) {
        return flags;
      }
    }

    const buckFlags = await this._loadFlagsFromBuck(src);
    if (isHeaderFile(src)) {
      // Accept flags from any source file in the target.
      if (buckFlags.size > 0) {
        return buckFlags.values().next().value;
      }
      // Try finding flags for a related source file.
      const projectRoot = (await BuckProject.getRootForPath(src)) || dbDir;
      // If we don't have a .buckconfig or a compile_commands.json, we won't find flags regardless.
      if (projectRoot == null) {
        return null;
      }
      const sourceFile = await ClangFlagsManager._findSourceFileForHeader(src, projectRoot);
      if (sourceFile != null) {
        return this.getFlagsForSrc(sourceFile);
      }
    }

    const flags = this.pathToFlags.get(src);
    if (flags != null) {
      return flags;
    }

    // Even if we can't get flags, try to watch the build file in case they get added.
    const buildFile = await ClangFlagsManager._guessBuildFile(src);
    if (buildFile != null) {
      return {
        flags: null,
        changes: this._watchFlagFile(buildFile),
      };
    }

    return null;
  }

  async _loadFlagsFromCompilationDatabase(dbFile: string): Promise<void> {
    if (this._compilationDatabases.has(dbFile)) {
      return;
    }

    try {
      const contents = await fsPromise.readFile(dbFile);
      const data = JSON.parse(contents);
      invariant(data instanceof Array);
      const changes = this._watchFlagFile(dbFile);
      await Promise.all(data.map(async entry => {
        const {command, file} = entry;
        const directory = await fsPromise.realpath(entry.directory, this._realpathCache);
        const args = ClangFlagsManager.parseArgumentsFromCommand(command);
        const filename = path.resolve(directory, file);
        if (await fsPromise.exists(filename)) {
          const realpath = await fsPromise.realpath(filename, this._realpathCache);
          this.pathToFlags.set(realpath, {
            flags: ClangFlagsManager.sanitizeCommand(file, args, directory),
            changes,
          });
        }
      }));
      this._compilationDatabases.add(dbFile);
    } catch (e) {
      logger.error(`Error reading compilation flags from ${dbFile}`, e);
    }
  }

  async _loadFlagsFromBuck(src: string): Promise<Map<string, ClangFlags>> {
    const flags = new Map();
    const buckProject = await this._getBuckProject(src);
    if (!buckProject) {
      return flags;
    }

    const target = (await buckProject.getOwner(src))
      .find(x => x.indexOf(DEFAULT_HEADERS_TARGET) === -1);

    if (target == null) {
      return flags;
    }

    // TODO(mbolin): The architecture should be chosen from a dropdown menu like
    // it is in Xcode rather than hardcoding things to iphonesimulator-x86_64.
    let arch;
    if (process.platform === 'darwin') {
      arch = 'iphonesimulator-x86_64';
    } else {
      arch = 'default';
    }
    const buildTarget = target + '#compilation-database,' + arch;
    // Since this is a background process, limit the number of threads to avoid
    // impacting the user too badly.
    const maxCpus = Math.ceil(os.cpus().length / 2);
    const buildReport = await buckProject.build(
      [buildTarget, '-j', String(maxCpus)],
      {commandOptions: {timeout: BUCK_TIMEOUT}},
    );
    if (!buildReport.success) {
      const error = `Failed to build ${buildTarget}`;
      logger.error(error);
      throw error;
    }
    const buckProjectRoot = await buckProject.getPath();
    let pathToCompilationDatabase = buildReport['results'][buildTarget]['output'];
    pathToCompilationDatabase = path.join(
        buckProjectRoot,
        pathToCompilationDatabase);

    const compilationDatabaseJsonBuffer = await fsPromise.readFile(pathToCompilationDatabase);
    const compilationDatabaseJson = compilationDatabaseJsonBuffer.toString('utf8');
    const compilationDatabase = JSON.parse(compilationDatabaseJson);

    const buildFile = await buckProject.getBuildFile(target);
    const changes = buildFile == null ? Observable.empty() : this._watchFlagFile(buildFile);
    compilationDatabase.forEach(item => {
      const {file} = item;
      const result = {
        flags: ClangFlagsManager.sanitizeCommand(
          file,
          item.arguments,
          buckProjectRoot,
        ),
        changes,
      };
      flags.set(file, result);
      this.pathToFlags.set(file, result);
    });
    return flags;
  }

  _watchFlagFile(flagFile: string): Observable<string> {
    const existing = this._flagFileObservables.get(flagFile);
    if (existing != null) {
      return existing;
    }
    const flagFileDir = path.dirname(flagFile);
    const flagFileBase = path.basename(flagFile);
    const observable = Observable.create(obs => {
      const watcher = fs.watch(flagFileDir, {}, (event, filename) => {
        if (filename === flagFileBase) {
          obs.next(event);
        }
      });
      watcher.on('error', err => {
        logger.error(`Could not watch file ${flagFile}`, err);
        obs.error(err);
      });
      return {
        unsubscribe() {
          watcher.close();
        },
      };
    }).share();
    this._flagFileObservables.set(flagFile, observable);
    return observable;
  }

  // The file may be new. Look for a nearby BUCK or TARGETS file.
  static async _guessBuildFile(file: string): Promise<?string> {
    const dir = path.dirname(file);
    let bestMatch = null;
    await Promise.all(['BUCK', 'TARGETS', 'compile_commands.json'].map(async name => {
      const nearestDir = await fsPromise.findNearestFile(name, dir);
      if (nearestDir != null) {
        const match = path.join(nearestDir, name);
        // Return the closest (most specific) match.
        if (bestMatch == null || match.length > bestMatch.length) {
          bestMatch = match;
        }
      }
    }));
    return bestMatch;
  }

  static parseArgumentsFromCommand(command: string): Array<string> {
    const result = [];
    // shell-quote returns objects for things like pipes.
    // This should never happen with proper flags, but ignore them to be safe.
    for (const arg of parse(command)) {
      if (typeof arg !== 'string') {
        break;
      }
      result.push(arg);
    }
    return result;
  }

  static sanitizeCommand(
    sourceFile: string,
    args: Array<string>,
    basePath: string
  ): Array<string> {
    // For safety, create a new copy of the array. We exclude the path to the file to compile from
    // compilation database generated by Buck. It must be removed from the list of command-line
    // arguments passed to libclang.
    const normalizedSourceFile = path.normalize(sourceFile);
    args = args.filter(arg =>
      normalizedSourceFile !== arg &&
      normalizedSourceFile !== path.resolve(basePath, arg)
    );

    // Resolve relative path arguments against the Buck project root.
    args.forEach((arg, argIndex) => {
      if (CLANG_FLAGS_THAT_TAKE_PATHS.has(arg)) {
        const nextIndex = argIndex + 1;
        let filePath = overrideIncludePath(args[nextIndex]);
        if (!path.isAbsolute(filePath)) {
          filePath = path.join(basePath, filePath);
        }
        args[nextIndex] = filePath;
      } else if (SINGLE_LETTER_CLANG_FLAGS_THAT_TAKE_PATHS.has(arg.substring(0, 2))) {
        let filePath = overrideIncludePath(arg.substring(2));
        if (!path.isAbsolute(filePath)) {
          filePath = path.join(basePath, filePath);
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
    const dir = path.dirname(header);
    const files = await fsPromise.readdir(dir);
    const basename = ClangFlagsManager._getFileBasename(header);
    for (const file of files) {
      if (isSourceFile(file) && ClangFlagsManager._getFileBasename(file) === basename) {
        return path.join(dir, file);
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
    let basename = path.basename(file);
    const ext = basename.lastIndexOf('.');
    if (ext !== -1) {
      basename = basename.substr(0, ext);
    }
    return basename.replace(/(Internal|-inl)$/, '');
  }
}

module.exports = ClangFlagsManager;
