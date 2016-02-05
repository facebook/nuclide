'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

/* @providesModule LocalHgServiceBase */

import {HgStatusOption} from './hg-constants';
import {Observable, Subject} from 'rx';
import {parseHgBlameOutput} from './hg-blame-output-parser';
import {parseMultiFileHgDiffUnifiedOutput} from './hg-diff-output-parser';
import {
  expressionForCommonAncestor,
  expressionForRevisionsBeforeHead,
  fetchRevisionInfoBetweenRevisions,
} from './hg-revision-expression-helpers';
import {
  fetchFileContentAtRevision,
  fetchFilesChangedAtRevision,
} from './hg-revision-state-helpers';
import {asyncExecute, createArgsForScriptCommand} from '../../commons';
import path from 'path';

import type {DiffInfo, RevisionFileChanges, StatusCodeIdValue, RevisionInfo} from './hg-constants';
import type {NuclideUri} from '../../remote-uri';

import {readArcConfig} from '../../arcanist-base';

const DEFAULT_FORK_BASE_NAME = 'default';

let logger;
function getLogger() {
  if (!logger) {
    logger = require('../../logging').getLogger();
  }
  return logger;
}

async function getForkBaseName(directoryPath: string): Promise<string> {
  const arcConfig = await readArcConfig(directoryPath);
  if (arcConfig != null) {
    return arcConfig['arc.feature.start.default'] || arcConfig['arc.land.onto.default'];
  }
  return DEFAULT_FORK_BASE_NAME;
}

class HgServiceBase {
  _workingDirectory: string;
  _filesDidChangeObserver: Subject;
  _hgIgnoreFileDidChangeObserver: Subject;
  _hgRepoStateDidChangeObserver: Subject;
  _hgBookmarkDidChangeObserver: Subject;

  constructor(workingDirectory: string) {
    this._workingDirectory = workingDirectory;
    this._filesDidChangeObserver = new Subject();
    this._hgIgnoreFileDidChangeObserver = new Subject();
    this._hgRepoStateDidChangeObserver = new Subject();
    this._hgBookmarkDidChangeObserver = new Subject();
  }

  async dispose(): Promise<void> {
    this._filesDidChangeObserver.onCompleted();
    this._hgIgnoreFileDidChangeObserver.onCompleted();
    this._hgRepoStateDidChangeObserver.onCompleted();
    this._hgBookmarkDidChangeObserver.onCompleted();
  }

  getWorkingDirectory(): string {
    return this._workingDirectory;
  }

  /**
   * See HgService::fetchStatuses for details.
   */
  async fetchStatuses(
    filePaths: Array<string>,
    options: ?any
  ): Promise<Map<string, StatusCodeIdValue>> {
    const statusMap = new Map();

    let args = ['status', '-Tjson'];
    if (options && ('hgStatusOption' in options)) {
      if (options.hgStatusOption === HgStatusOption.ONLY_IGNORED) {
        args.push('--ignored');
      } else if (options.hgStatusOption === HgStatusOption.ALL_STATUSES) {
        args.push('--all');
      }
    }
    args = args.concat(filePaths);
    const execOptions = {
      cwd: this.getWorkingDirectory(),
    };
    let output;
    try {
      output = await this._hgAsyncExecute(args, execOptions);
    } catch (e) {
      return statusMap;
    }

    const statuses = JSON.parse(output.stdout);
    statuses.forEach(status => {
      statusMap.set(this._absolutize(status.path), status.status);
    });
    return statusMap;
  }

  // Mercurial returns all paths relative to the repository's working directory.
  // This method transforms a path relative to the working direcotry into an
  // absolute path.
  _absolutize(pathRelativeToWorkingDirectory: string): string {
    return path.join(this._workingDirectory, pathRelativeToWorkingDirectory);
  }

  /**
   * See HgService.def::observeFilesDidChange for details.
   */
  observeFilesDidChange(): Observable<Array<NuclideUri>> {
    return this._filesDidChangeObserver;
  }

  /**
   * See HgService.def::observeHgIgnoreFileDidChange for details.
   */
  observeHgIgnoreFileDidChange(): Observable<void> {
    return this._hgIgnoreFileDidChangeObserver;
  }

  /**
   * See HgService.def::observeHgRepoStateDidChange for details.
   */
  observeHgRepoStateDidChange(): Observable<void> {
    return this._hgRepoStateDidChangeObserver;
  }

  /**
   * See HgService.def::fetchDiffInfoForPaths for details.
   */
  async fetchDiffInfo(
    filePaths: Array<NuclideUri>,
  ): Promise<?Map<NuclideUri, DiffInfo>>
  {
    // '--unified 0' gives us 0 lines of context around each change (we don't
    // care about the context).
    // '--noprefix' omits the a/ and b/ prefixes from filenames.
    // '--nodates' avoids appending dates to the file path line.
    const args = ['diff', '--unified', '0', '--noprefix', '--nodates'].concat(filePaths);
    const options = {
      cwd: this.getWorkingDirectory(),
    };
    let output;
    try {
      output = await this._hgAsyncExecute(args, options);
    } catch (e) {
      getLogger().error(
          `Error when running hg diff for paths: ${filePaths} \n\tError: ${e.stderr}`);
      return null;
    }
    const pathToDiffInfo = parseMultiFileHgDiffUnifiedOutput(output.stdout);
    const absolutePathToDiffInfo = new Map();
    for (const [filePath, diffInfo] of pathToDiffInfo) {
      absolutePathToDiffInfo.set(this._absolutize(filePath), diffInfo);
    }
    return absolutePathToDiffInfo;
  }

  /**
   * Calls out to asyncExecute using the 'hg' command.
   * @param options as specified by http://nodejs.org/api/child_process.html. Additional options:
   *   - NO_HGPLAIN set if the $HGPLAIN environment variable should not be used.
   *   - TTY_OUTPUT set if the command should be run as if it were attached to a tty.
   */
  async _hgAsyncExecute(args: Array<string>, options: any): Promise<any> {
    if (!options['NO_HGPLAIN']) {
      // Setting HGPLAIN=1 overrides any custom aliases a user has defined.
      if (options.env) {
        options.env['HGPLAIN'] = 1;
      } else {
        const {assign} = require('../../commons').object;
        const env = {'HGPLAIN': 1};
        assign(env, process.env);
        options.env = env;
      }
    }

    let cmd;
    if (options['TTY_OUTPUT']) {
      cmd = 'script';
      args = createArgsForScriptCommand('hg', args);
    } else {
      cmd = 'hg';
    }
    try {
      return await asyncExecute(cmd, args, options);
    } catch (e) {
      getLogger().error(`Error executing hg command: ${JSON.stringify(args)} ` +
          `options: ${JSON.stringify(options)} ${JSON.stringify(e)}`);
      throw e;
    }
  }

  fetchCurrentBookmark(): Promise<string> {
    const {fetchCurrentBookmark} = require('./hg-bookmark-helpers');
    return fetchCurrentBookmark(path.join(this._workingDirectory, '.hg'));
  }

  /**
   * See HgService:.def:observeHgBookmarkDidChange for details.
   */
  observeHgBookmarkDidChange(): Observable<void> {
    return this._hgBookmarkDidChangeObserver;
  }

  /**
   * Section: Repository State at Specific Revisions
   */

  fetchFileContentAtRevision(filePath: NuclideUri, revision: ?string): Promise<?string> {
    return fetchFileContentAtRevision(filePath, revision, this._workingDirectory);
  }

  fetchFilesChangedAtRevision(revision: string): Promise<?RevisionFileChanges> {
    return fetchFilesChangedAtRevision(revision, this._workingDirectory);
  }

  async fetchRevisionInfoBetweenHeadAndBase(): Promise<?Array<RevisionInfo>> {
    const fokBaseName = await getForkBaseName(this._workingDirectory);
    const revisionsInfo = await fetchRevisionInfoBetweenRevisions(
      expressionForCommonAncestor(fokBaseName),
      expressionForRevisionsBeforeHead(0),
      this._workingDirectory,
    );
    return revisionsInfo;
  }

  async getBlameAtHead(filePath: NuclideUri): Promise<Map<string, string>> {
    const args =
      ['blame', '-r', 'wdir()', '-Tjson', '--changeset', '--user', '--line-number', filePath];
    const execOptions = {
      cwd: this.getWorkingDirectory(),
    };
    let output;
    try {
      output = await this._hgAsyncExecute(args, execOptions);
    } catch (e) {
      getLogger().error(
          `LocalHgServiceBase failed to fetch blame for file: ${filePath}. Error: ${e.stderr}`);
      throw e;
    }
    return parseHgBlameOutput(output.stdout);
  }

  /**
   * This implementation relies on the "phabdiff" template being available as defined in:
   * https://bitbucket.org/facebook/hg-experimental/src/fbf23b3f96bade5986121a7c57d7400585d75f54/phabdiff.py.
   */
  async getDifferentialRevisionForChangeSetId(changeSetId: string): Promise<?string> {
    const args = ['log', '-T', '{phabdiff}\n', '--limit', '1', '--rev', changeSetId];
    const execOptions = {
      cwd: this.getWorkingDirectory(),
    };
    try {
      const output = await this._hgAsyncExecute(args, execOptions);
      const stdout = output.stdout.trim();
      return stdout ? stdout : null;
    } catch (e) {
      // This should not happen: `hg log` does not error even if it does not recognize the template.
      getLogger().error(`Failed when trying to get differential revision for: ${changeSetId}`);
      return null;
    }
  }

  // TODO (chenshen) The return type should be `AsyncExecuteRet` inf `HgService.def`, but flow
  // doesn't allow importing `.def` file unless we merge `HgService.def` to this file.
  async getSmartlog(ttyOutput: boolean, concise: boolean): Promise<Object> {
    // disable the pager extension so that 'hg sl' terminates. We can't just use
    // HGPLAIN because we have not found a way to get colored output when we do.
    const args = ['--config', 'extensions.pager=!', concise ? 'sl' : 'smartlog'];
    const execOptions = {
      cwd: this.getWorkingDirectory(),
      NO_HGPLAIN: concise, // `hg sl` is likely user-defined.
      TTY_OUTPUT: ttyOutput,
    };
    return await this._hgAsyncExecute(args, execOptions);
  }

  async _runSimpleInWorkingDirectory(
    action: string,
    args: Array<string>,
  ): Promise<boolean> {
    const options = {
      cwd: this.getWorkingDirectory(),
    };
    const cmd = [action].concat(args);
    try {
      await this._hgAsyncExecute(cmd, options);
    } catch (e) {
      getLogger().error(
        'hg %s failed with [%s] arguments: %s',
        cmd,
        args.toString(),
        e.toString(),
      );
      return false;
    }
    return true;
  }

  checkout(revision: string, create: boolean): Promise<boolean> {
    return this._runSimpleInWorkingDirectory('checkout', [revision]);
  }

  rename(oldFilePath: string, newFilePath: string): Promise<boolean> {
    return this._runSimpleInWorkingDirectory(
      'rename',
      [oldFilePath, newFilePath],
    );
  }

  remove(filePath: string): Promise<boolean> {
    return this._runSimpleInWorkingDirectory('remove', [filePath]);
  }

  add(filePath: string): Promise<boolean> {
    return this._runSimpleInWorkingDirectory('add', [filePath]);
  }
}


module.exports = HgServiceBase;
