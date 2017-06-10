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

import type {ConnectableObservable} from 'rxjs';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {HgExecOptions} from './hg-exec-types';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {WatchmanClient} from '../../nuclide-watchman-helpers';
import fs from 'fs';

import {
  AmendMode,
  MergeConflictFileStatus,
  MergeConflictStatus,
} from './hg-constants';
import {Subject} from 'rxjs';
import {parseMultiFileHgDiffUnifiedOutput} from './hg-diff-output-parser';
import {
  expressionForCommonAncestor,
  expressionForRevisionsBeforeHead,
  fetchRevisionInfoBetweenRevisions,
  fetchRevisionInfo,
  fetchRevisionsInfo,
  fetchSmartlogRevisions,
} from './hg-revision-expression-helpers';
import {
  fetchFileContentAtRevision,
  fetchFilesChangedAtRevision,
} from './hg-revision-state-helpers';
import {
  formatCommitMessage,
  getInteractiveCommitEditorConfig,
  hgAsyncExecute,
  hgObserveExecution,
  hgRunCommand,
  processExitCodeAndThrow,
} from './hg-utils';
import fsPromise from 'nuclide-commons/fsPromise';
import debounce from 'nuclide-commons/debounce';
import invariant from 'assert';

import {fetchActiveBookmark} from './hg-bookmark-helpers';
import {readArcConfig} from '../../nuclide-arcanist-rpc';
import {getLogger} from 'log4js';
import {Observable} from 'rxjs';

const logger = getLogger('nuclide-hg-rpc');
const DEFAULT_ARC_PROJECT_FORK_BASE = 'remote/master';
const DEFAULT_FORK_BASE_NAME = 'default';

const WATCHMAN_SUBSCRIPTION_NAME_PRIMARY =
  'hg-repository-watchman-subscription-primary';
const WATCHMAN_SUBSCRIPTION_NAME_HGBOOKMARK =
  'hg-repository-watchman-subscription-hgbookmark';
const WATCHMAN_SUBSCRIPTION_NAME_HGBOOKMARKS =
  'hg-repository-watchman-subscription-hgbookmarks';
const WATCHMAN_HG_DIR_STATE = 'hg-repository-watchman-subscription-dirstate';
const WATCHMAN_SUBSCRIPTION_NAME_CONFLICTS =
  'hg-repository-watchman-subscription-conflicts';

const CHECK_CONFLICT_DELAY_MS = 2000;
const COMMIT_CHANGE_DEBOUNCE_MS = 1000;

// If Watchman reports that many files have changed, it's not really useful to report this.
// This is typically caused by a large rebase or a Watchman re-crawl.
// We'll just report that the repository state changed, which should trigger a full client refresh.
const FILES_CHANGED_LIMIT = 1000;

// Suffixes of hg error messages that indicate that an error is safe to ignore,
// and should not warrant a user-visible error. These generally happen
// when performing an hg operation on a non-existent or untracked file.
const IGNORABLE_ERROR_SUFFIXES = [
  'abort: no files to copy',
  'No such file or directory',
  'does not exist!',
];

/**
 * These are status codes used by Mercurial's output.
 * Documented in http://selenic.com/hg/help/status.
 */
export type StatusCodeIdValue = 'A' | 'C' | 'I' | 'M' | '!' | 'R' | '?' | 'U';

export type MergeConflictStatusValue =
  | 'both changed'
  | 'deleted in theirs'
  | 'deleted in ours'
  | 'resolved';

export type MergeConflictStatusCodeId = 'R' | 'U';

/**
 * Internally, the HgRepository uses the string StatusCodeId to do bookkeeping.
 * However, GitRepository uses numbers to represent its statuses, and returns
 * statuses as numbers. In order to keep our status 'types' the same, we map the
 * string StatusCodeId to numbers.
 * The numbers themselves should not matter; they are meant to be passed
 * to ::isStatusNew/::isStatusModified to be interpreted.
 */
export type StatusCodeNumberValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type LineDiff = {
  oldStart: number,
  oldLines: number,
  newStart: number,
  newLines: number,
};

export type BookmarkInfo = {
  active: boolean,
  bookmark: string,
  node: string,
  rev: number,
};

export type DiffInfo = {
  added: number,
  deleted: number,
  lineDiffs: Array<LineDiff>,
};

export type CommitPhaseType = 'public' | 'draft' | 'secret';

export type SuccessorTypeValue =
  | 'public'
  | 'amend'
  | 'rebase'
  | 'split'
  | 'fold'
  | 'histedit';

export type RevisionSuccessorInfo = {
  hash: string,
  type: SuccessorTypeValue,
};

export type RevisionInfo = {
  author: string,
  bookmarks: Array<string>,
  branch: string,
  date: Date,
  description: string,
  hash: string,
  id: number,
  isHead: boolean,
  remoteBookmarks: Array<string>,
  parents: Array<string>,
  phase: CommitPhaseType,
  successorInfo: ?RevisionSuccessorInfo,
  tags: Array<string>,
  title: string,
};

export type RevisionShowInfo = {
  diff: string,
};

export type AsyncExecuteRet = {
  command?: string,
  errorMessage?: string,
  exitCode: number,
  stderr: string,
  stdout: string,
};

export type RevisionFileCopy = {
  from: NuclideUri,
  to: NuclideUri,
};

export type RevisionFileChanges = {
  all: Array<NuclideUri>,
  added: Array<NuclideUri>,
  deleted: Array<NuclideUri>,
  copied: Array<RevisionFileCopy>,
  modified: Array<NuclideUri>,
};

export type VcsLogEntry = {
  node: string,
  user: string,
  desc: string,
  date: [number, number],
};

export type VcsLogResponse = {
  entries: Array<VcsLogEntry>,
};

export type MergeConflict = {
  path: string,
  status: MergeConflictStatusValue,
  mergeConflictsCount?: number,
  resolvedConflictsCount?: number,
};

// Information about file for local, base and other commit that caused the conflict
export type MergeConflictSideFileData = {
  contents: ?string,
  exists: boolean,
  isexec: ?boolean,
  issymlink: ?boolean,
};

// Information about the output file
export type MergeConflictOutputFileData = MergeConflictSideFileData & {
  path: NuclideUri,
};

export type MergeConflictFileData = {
  base: MergeConflictSideFileData,
  local: MergeConflictSideFileData,
  other: MergeConflictSideFileData,
  output: MergeConflictOutputFileData,
  status: MergeConflictStatusValue,
  conflictCount?: number,
};

export type MergeConflictsEnriched = {
  conflicts: Array<MergeConflictFileData>,
  command: string,
};

export type CheckoutSideName = 'ours' | 'theirs';

export type AmendModeValue = 'Clean' | 'Rebase' | 'Fixup';

export type CheckoutOptions = {
  clean?: true,
};

async function logWhenSubscriptionEstablished(
  sub: Promise<mixed>,
  subName: string,
): Promise<void> {
  await sub;
  logger.debug(`Watchman subscription ${subName} established.`);
}

async function getForkBaseName(directoryPath: string): Promise<string> {
  const arcConfig = await readArcConfig(directoryPath);
  if (arcConfig != null) {
    return (
      arcConfig['arc.feature.start.default'] ||
      arcConfig['arc.land.onto.default'] ||
      DEFAULT_ARC_PROJECT_FORK_BASE
    );
  }
  return DEFAULT_FORK_BASE_NAME;
}

/**
 * @return Array of additional watch expressions to apply to the primary
 *   watchman subscription.
 */
function getPrimaryWatchmanSubscriptionRefinements(): Array<mixed> {
  let refinements = [];
  try {
    // $FlowFB
    refinements = require('./fb/config').primaryWatchSubscriptionRefinements;
  } catch (e) {
    // purposely blank
  }
  return refinements;
}

export class HgService {
  _isInConflict: boolean;
  _watchmanClient: ?WatchmanClient;
  _origBackupPath: ?string;

  _workingDirectory: string;
  _filesDidChangeObserver: Subject<any>;
  _hgActiveBookmarkDidChangeObserver: Subject<any>;
  _hgBookmarksDidChangeObserver: Subject<any>;
  _hgRepoStateDidChangeObserver: Subject<any>;
  _hgRepoCommitsDidChangeObserver: Subject<void>;
  _watchmanSubscriptionPromise: Promise<void>;
  _hgConflictStateDidChangeObserver: Subject<boolean>;
  _debouncedCheckConflictChange: () => void;
  _hgStoreDirWatcher: ?fs.FSWatcher;

  constructor(workingDirectory: string) {
    this._workingDirectory = workingDirectory;
    this._filesDidChangeObserver = new Subject();
    this._hgActiveBookmarkDidChangeObserver = new Subject();
    this._hgBookmarksDidChangeObserver = new Subject();
    this._hgRepoStateDidChangeObserver = new Subject();
    this._hgConflictStateDidChangeObserver = new Subject();
    this._hgRepoCommitsDidChangeObserver = new Subject();
    this._isInConflict = false;
    this._debouncedCheckConflictChange = debounce(() => {
      this._checkConflictChange();
    }, CHECK_CONFLICT_DELAY_MS);
    this._watchmanSubscriptionPromise = this._subscribeToWatchman();
  }

  waitForWatchmanSubscriptions(): Promise<void> {
    return this._watchmanSubscriptionPromise;
  }

  async dispose(): Promise<void> {
    this._filesDidChangeObserver.complete();
    this._hgRepoStateDidChangeObserver.complete();
    this._hgActiveBookmarkDidChangeObserver.complete();
    this._hgBookmarksDidChangeObserver.complete();
    this._hgConflictStateDidChangeObserver.complete();
    if (this._hgStoreDirWatcher != null) {
      this._hgStoreDirWatcher.close();
      this._hgStoreDirWatcher = null;
    }
    await this._cleanUpWatchman();
  }

  // Wrapper to help mocking during tests.
  _hgAsyncExecute(args: Array<string>, options: HgExecOptions): Promise<any> {
    return hgAsyncExecute(args, options);
  }

  _hgObserveExecution(
    args: Array<string>,
    options: HgExecOptions,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return hgObserveExecution(args, options);
  }

  _hgRunCommand(
    args: Array<string>,
    options: HgExecOptions,
  ): Observable<string> {
    return hgRunCommand(args, options);
  }

  /**
   * Section: File and Repository Status
   */

  /**
    * Shells out of the `hg status` to get the statuses of the paths.
    */
  fetchStatuses(
    toRevision?: string,
  ): ConnectableObservable<Map<NuclideUri, StatusCodeIdValue>> {
    const execOptions = {
      cwd: this._workingDirectory,
    };
    const args = ['status', '-Tjson'];
    if (toRevision != null) {
      args.push('--rev', toRevision);
    }

    return hgRunCommand(args, execOptions)
      .map(stdout => {
        const statusMap = new Map();
        const statuses = JSON.parse(stdout);
        for (const status of statuses) {
          statusMap.set(
            nuclideUri.join(this._workingDirectory, status.path),
            status.status,
          );
        }
        return statusMap;
      })
      .publish();
  }

  /**
   * Like fetchStatuses, but first calculates the root of the current
   * stack and fetches changes since that revision.
   */
  fetchStackStatuses(): ConnectableObservable<
    Map<NuclideUri, StatusCodeIdValue>,
  > {
    // Note: an alternative which doesn't depend upon reading .arcconfig in getForkBaseName is:
    //   return this.fetchStatuses('ancestor(ancestor((not public()) and (:: .))^ or .)')
    // Both the code below and the alternative above have identical performance.

    return Observable.fromPromise(getForkBaseName(this._workingDirectory)) // e.g. "master"
      .switchMap(forkBaseName => {
        const root = expressionForCommonAncestor(forkBaseName); // e.g. "ancestor(master, .)"
        return this.fetchStatuses(root).refCount();
      })
      .publish();
  }

  /**
   * Like fetchStatuses, but first checks whether the head is public. If so, returns
   * changes *since* the head. If not, returns changes *including* the head.
   */
  fetchHeadStatuses(): ConnectableObservable<
    Map<NuclideUri, StatusCodeIdValue>,
  > {
    return this.fetchStatuses('ancestor(. or (. and (not public()))^)');
  }

  async _subscribeToWatchman(): Promise<void> {
    // Using a local variable here to allow better type refinement.
    const watchmanClient = new WatchmanClient();
    this._watchmanClient = watchmanClient;
    const workingDirectory = this._workingDirectory;

    let primarySubscriptionExpression: Array<mixed> = [
      'allof',
      ['not', ['dirname', '.hg']],
      // Hg appears to modify temporary files that begin with these
      // prefixes, every time a file is saved.
      ['not', ['match', 'hg-checkexec-*', 'wholename']],
      ['not', ['match', 'hg-checklink-*', 'wholename']],
      // This watchman subscription is used to determine when and which
      // files to fetch new statuses for. There is no reason to include
      // directories in these updates, and in fact they may make us overfetch
      // statuses. (See diff summary of D2021498.)
      // This line restricts this subscription to only return files.
      ['type', 'f'],
    ];
    primarySubscriptionExpression = primarySubscriptionExpression.concat(
      getPrimaryWatchmanSubscriptionRefinements(),
    );

    // Subscribe to changes to files unrelated to source control.
    const primarySubscriptionPromise = watchmanClient.watchDirectoryRecursive(
      workingDirectory,
      WATCHMAN_SUBSCRIPTION_NAME_PRIMARY,
      {
        fields: ['name', 'exists', 'new'],
        expression: primarySubscriptionExpression,
        defer: ['hg.update'],
        empty_on_fresh_instance: true,
      },
    );
    logWhenSubscriptionEstablished(
      primarySubscriptionPromise,
      WATCHMAN_SUBSCRIPTION_NAME_PRIMARY,
    );

    // Subscribe to changes to files unrelated to source control.
    const conflictStateSubscriptionPromise = watchmanClient.watchDirectoryRecursive(
      workingDirectory,
      WATCHMAN_SUBSCRIPTION_NAME_CONFLICTS,
      {
        fields: ['name', 'exists', 'new'],
        expression: ['name', '.hg/merge', 'wholename'],
        defer: ['hg.update'],
        empty_on_fresh_instance: true,
      },
    );
    logWhenSubscriptionEstablished(
      conflictStateSubscriptionPromise,
      WATCHMAN_SUBSCRIPTION_NAME_CONFLICTS,
    );

    // Subscribe to changes to the active Mercurial bookmark.
    const hgActiveBookmarkSubscriptionPromise = watchmanClient.watchDirectoryRecursive(
      workingDirectory,
      WATCHMAN_SUBSCRIPTION_NAME_HGBOOKMARK,
      {
        fields: ['name', 'exists'],
        expression: ['name', '.hg/bookmarks.current', 'wholename'],
        defer: ['hg.update'],
        empty_on_fresh_instance: true,
      },
    );
    logWhenSubscriptionEstablished(
      hgActiveBookmarkSubscriptionPromise,
      WATCHMAN_SUBSCRIPTION_NAME_HGBOOKMARK,
    );

    // Subscribe to changes in Mercurial bookmarks.
    const hgBookmarksSubscriptionPromise = watchmanClient.watchDirectoryRecursive(
      workingDirectory,
      WATCHMAN_SUBSCRIPTION_NAME_HGBOOKMARKS,
      {
        fields: ['name', 'exists'],
        expression: ['name', '.hg/bookmarks', 'wholename'],
        defer: ['hg.update'],
        empty_on_fresh_instance: true,
      },
    );
    logWhenSubscriptionEstablished(
      hgBookmarksSubscriptionPromise,
      WATCHMAN_SUBSCRIPTION_NAME_HGBOOKMARKS,
    );

    const dirStateSubscriptionPromise = watchmanClient.watchDirectoryRecursive(
      workingDirectory,
      WATCHMAN_HG_DIR_STATE,
      {
        fields: ['name'],
        expression: ['name', '.hg/dirstate', 'wholename'],
        defer: ['hg.update'],
        empty_on_fresh_instance: true,
      },
    );
    logWhenSubscriptionEstablished(
      dirStateSubscriptionPromise,
      WATCHMAN_HG_DIR_STATE,
    );

    // Those files' changes indicate a commit-changing action has been applied to the repository,
    // Watchman currently (v4.7) ignores `.hg/store` file updates.
    // Hence, we here use node's filesystem watchers instead.
    const hgStoreDirectory = nuclideUri.join(workingDirectory, '.hg', 'store');
    const commitChangeIndicators = ['00changelog.i', 'obsstore', 'inhibit'];
    try {
      this._hgStoreDirWatcher = fs.watch(
        hgStoreDirectory,
        (event, fileName) => {
          if (commitChangeIndicators.indexOf(fileName) === -1) {
            this._commitsDidChange();
          }
        },
      );
      getLogger('nuclide-hg-rpc').debug('Node watcher created for .hg/store.');
    } catch (error) {
      getLogger('nuclide-hg-rpc').error(
        'Error when creating node watcher for hg store',
        error,
      );
    }

    const [
      primarySubscription,
      hgActiveBookmarkSubscription,
      hgBookmarksSubscription,
      dirStateSubscription,
      conflictStateSubscription,
    ] = await Promise.all([
      primarySubscriptionPromise,
      hgActiveBookmarkSubscriptionPromise,
      hgBookmarksSubscriptionPromise,
      dirStateSubscriptionPromise,
      conflictStateSubscriptionPromise,
    ]);

    primarySubscription.on('change', this._filesDidChange.bind(this));
    hgActiveBookmarkSubscription.on(
      'change',
      this._hgActiveBookmarkDidChange.bind(this),
    );
    hgBookmarksSubscription.on('change', this._hgBookmarksDidChange.bind(this));
    dirStateSubscription.on('change', this._emitHgRepoStateChanged.bind(this));
    conflictStateSubscription.on('change', this._debouncedCheckConflictChange);
  }

  async _cleanUpWatchman(): Promise<void> {
    if (this._watchmanClient != null) {
      await this._watchmanClient.dispose();
      this._watchmanClient = null;
    }
  }

  /**
   * @param fileChanges The latest changed watchman files.
   */
  _filesDidChange(fileChanges: Array<any>): void {
    if (fileChanges.length > FILES_CHANGED_LIMIT) {
      this._emitHgRepoStateChanged();
      return;
    }

    const workingDirectory = this._workingDirectory;
    const changedFiles = fileChanges.map(change =>
      nuclideUri.join(workingDirectory, change.name),
    );
    this._filesDidChangeObserver.next(changedFiles);
  }

  _commitsDidChange(): void {
    this._hgRepoCommitsDidChangeObserver.next();
  }

  _checkMergeDirectoryExists(): Promise<boolean> {
    return fsPromise.exists(
      nuclideUri.join(this._workingDirectory, '.hg', 'merge'),
    );
  }

  async _checkConflictChange(): Promise<void> {
    const mergeDirectoryExists = await this._checkMergeDirectoryExists();
    if (this._isInConflict) {
      if (!mergeDirectoryExists) {
        this._isInConflict = false;
        this._hgConflictStateDidChangeObserver.next(false);
      }
      return;
    } else if (mergeDirectoryExists) {
      // Detect if the repository is in a conflict state.
      const mergeConflicts = await this.fetchMergeConflicts();
      if (mergeConflicts.length > 0) {
        this._isInConflict = true;
        this._hgConflictStateDidChangeObserver.next(true);
      }
    }
  }

  _emitHgRepoStateChanged(): void {
    this._hgRepoStateDidChangeObserver.next();
  }

  _hgActiveBookmarkDidChange(): void {
    this._hgActiveBookmarkDidChangeObserver.next();
  }

  _hgBookmarksDidChange(): void {
    this._hgBookmarksDidChangeObserver.next();
  }

  /**
   * Observes one of more files has changed. Applies to all files except
   * .hgignore files. (See ::onHgIgnoreFileDidChange.)
   * @return A Observable which emits the changed file paths.
   */
  observeFilesDidChange(): ConnectableObservable<Array<NuclideUri>> {
    return this._filesDidChangeObserver.publish();
  }

  /**
   * Observes that a Mercurial repository commits state have changed
   * (e.g. commit, amend, histedit, strip, rebase) that would require refetching from the service.
   */
  observeHgCommitsDidChange(): ConnectableObservable<void> {
    return (
      this._hgRepoCommitsDidChangeObserver
        // Upon rebase, this can fire once per added commit!
        // Apply a generous debounce to avoid overloading the RPC connection.
        .debounceTime(COMMIT_CHANGE_DEBOUNCE_MS)
        .publish()
    );
  }

  /**
   * Observes that a Mercurial event has occurred (e.g. histedit) that would
   * potentially invalidate any data cached from responses from this service.
   */
  observeHgRepoStateDidChange(): ConnectableObservable<void> {
    return this._hgRepoStateDidChangeObserver.publish();
  }

  /**
   * Observes when a Mercurial repository enters and exits a rebase state.
   */
  observeHgConflictStateDidChange(): ConnectableObservable<boolean> {
    this._checkConflictChange();
    return this._hgConflictStateDidChangeObserver.publish();
  }

  /**
   * Shells out to `hg diff` to retrieve line diff information for the paths.
   * @param An Array of NuclideUri (absolute paths) for which to fetch diff info.
   * @return A map of each NuclideUri (absolute path) to its DiffInfo.
   *   Each path is presumed to be in the repo.
   *   If the `hg diff` call fails, this method returns null.
   *   If a path has no changes, it will not appear in the returned Map.
   */
  async fetchDiffInfo(
    filePaths: Array<NuclideUri>,
  ): Promise<?Map<NuclideUri, DiffInfo>> {
    // '--unified 0' gives us 0 lines of context around each change (we don't
    // care about the context).
    // '--noprefix' omits the a/ and b/ prefixes from filenames.
    // '--nodates' avoids appending dates to the file path line.
    const args = ['diff', '--unified', '0', '--noprefix', '--nodates'].concat(
      filePaths,
    );
    const options = {
      cwd: this._workingDirectory,
    };
    let output;
    try {
      output = await this._hgAsyncExecute(args, options);
    } catch (e) {
      getLogger('nuclide-hg-rpc').error(
        `Error when running hg diff for paths: ${filePaths.toString()} \n\tError: ${e.stderr}`,
      );
      return null;
    }
    const pathToDiffInfo = parseMultiFileHgDiffUnifiedOutput(output.stdout);
    const absolutePathToDiffInfo = new Map();
    for (const [filePath, diffInfo] of pathToDiffInfo) {
      absolutePathToDiffInfo.set(
        nuclideUri.join(this._workingDirectory, filePath),
        diffInfo,
      );
    }
    return absolutePathToDiffInfo;
  }

  /**
   * Section: Bookmarks
   */

  createBookmark(name: string, revision: ?string): Promise<void> {
    const args = [];
    if (revision) {
      args.push('--rev', revision);
    }
    args.push(name);

    return this._runSimpleInWorkingDirectory('bookmark', args);
  }

  deleteBookmark(name: string): Promise<void> {
    return this._runSimpleInWorkingDirectory('bookmarks', ['--delete', name]);
  }

  renameBookmark(name: string, nextName: string): Promise<void> {
    return this._runSimpleInWorkingDirectory('bookmarks', [
      '--rename',
      name,
      nextName,
    ]);
  }

  /**
   * @return The name of the current bookmark.
   */
  fetchActiveBookmark(): Promise<string> {
    return fetchActiveBookmark(nuclideUri.join(this._workingDirectory, '.hg'));
  }

  /**
   * @return An Array of bookmarks for this repository.
   */
  fetchBookmarks(): ConnectableObservable<Array<BookmarkInfo>> {
    const args = ['bookmarks', '-Tjson'];
    const execOptions = {
      cwd: this._workingDirectory,
    };

    return this._hgRunCommand(args, execOptions)
      .map(stdout => JSON.parse(stdout))
      .publish();
  }

  /**
   * Observes that the active Mercurial bookmark has changed.
   */
  observeActiveBookmarkDidChange(): ConnectableObservable<void> {
    return this._hgActiveBookmarkDidChangeObserver.publish();
  }

  /**
   * Observes that Mercurial bookmarks have changed.
   */
  observeBookmarksDidChange(): ConnectableObservable<void> {
    return this._hgBookmarksDidChangeObserver.publish();
  }

  /**
   * Section: Repository State at Specific Revisions
   */

  /**
   * @param filePath: The full path to the file of interest.
   * @param revision: An expression that hg can understand, specifying the
   * revision at which we want to see the file content.
   */
  fetchFileContentAtRevision(
    filePath: NuclideUri,
    revision: string,
  ): ConnectableObservable<string> {
    return fetchFileContentAtRevision(
      filePath,
      revision,
      this._workingDirectory,
    );
  }

  fetchFilesChangedAtRevision(
    revision: string,
  ): ConnectableObservable<RevisionFileChanges> {
    return fetchFilesChangedAtRevision(revision, this._workingDirectory);
  }

  /**
   * Fetch the revision details between the current head and the the common ancestor
   * of head and master in the repository.
   * @return an array with the revision info (`title`, `author`, `date` and `id`)
   * or `null` if no common ancestor was found.
   */
  async fetchRevisionInfoBetweenHeadAndBase(): Promise<Array<RevisionInfo>> {
    const forkBaseName = await getForkBaseName(this._workingDirectory);
    const revisionsInfo = await fetchRevisionInfoBetweenRevisions(
      expressionForCommonAncestor(forkBaseName),
      expressionForRevisionsBeforeHead(0),
      this._workingDirectory,
    );
    return revisionsInfo;
  }

  fetchSmartlogRevisions(): ConnectableObservable<Array<RevisionInfo>> {
    return fetchSmartlogRevisions(this._workingDirectory);
  }

  /**
   * Resolve the revision details of the base branch
   */
  async getBaseRevision(): Promise<RevisionInfo> {
    const forkBaseName = await getForkBaseName(this._workingDirectory);
    return fetchRevisionInfo(
      expressionForCommonAncestor(forkBaseName),
      this._workingDirectory,
    );
  }

  /**
   * Gets the blame for the filePath at the current revision.
   * It returns null for uncommitted changes (but cannot detect unsaved changes)
   * @param filePath The file to get blame information for.
   * @return An Array that maps a line number (0-indexed) to the revision info.
   */
  async getBlameAtHead(filePath: NuclideUri): Promise<Array<?RevisionInfo>> {
    let revisionsByLine;
    try {
      revisionsByLine = (await this._hgAsyncExecute(
        [
          'blame',
          '-c', // Query the hash
          '-T',
          '{node|short}\n', // Just display the hash per line
          '-r',
          'wdir()', // Blank out uncommitted changes
          filePath,
        ],
        {cwd: this._workingDirectory},
      )).stdout.split('\n');
    } catch (e) {
      getLogger('nuclide-hg-rpc').error(
        `LocalHgServiceBase failed to fetch blame for file: ${filePath}. Error: ${e.stderr}`,
      );
      throw e;
    }

    const uniqueRevisions = [...(new Set(revisionsByLine.filter(e => e)): any)];

    let revisionsArray;
    try {
      revisionsArray = await fetchRevisionsInfo(
        uniqueRevisions.join('+'),
        this._workingDirectory,
        {hidden: true, shouldLimit: false},
      ).toPromise();
    } catch (e) {
      getLogger('nuclide-hg-rpc').error(
        `LocalHgServiceBase failed to fetch blame for file: ${filePath}. Error: ${e.stderr}`,
      );
      throw e;
    }

    const revisionsByHash = {};
    revisionsArray.forEach(revision => {
      revisionsByHash[revision.hash] = revision;
    });

    return revisionsByLine.map(hash => revisionsByHash[hash]);
  }

  /**
   * Returns the value of the config item at `key`.
   * @param key Name of config item
   */
  async getConfigValueAsync(key: string): Promise<?string> {
    const args = ['config', key];
    const execOptions = {
      cwd: this._workingDirectory,
    };
    try {
      return (await this._hgAsyncExecute(args, execOptions)).stdout.trim();
    } catch (e) {
      getLogger('nuclide-hg-rpc').error(
        `Failed to fetch Hg config for key ${key}.  Error: ${e.toString()}`,
      );
      return null;
    }
  }

  /**
   * Gets the Differential Revision id (aka DXXXXXX) id for the specified changeSetId, if it exists.
   * Otherwise, returns null.
   * This implementation relies on the "phabdiff" template being available as defined in:
   * https://bitbucket.org/facebook/hg-experimental/src/fbf23b3f96bade5986121a7c57d7400585d75f54/phabdiff.py.
   */
  async getDifferentialRevisionForChangeSetId(
    changeSetId: string,
  ): Promise<?string> {
    const args = [
      'log',
      '-T',
      '{phabdiff}\n',
      '--limit',
      '1',
      '--rev',
      changeSetId,
    ];
    const execOptions = {
      cwd: this._workingDirectory,
    };
    try {
      const output = await this._hgAsyncExecute(args, execOptions);
      const stdout = output.stdout.trim();
      return stdout ? stdout : null;
    } catch (e) {
      // This should not happen: `hg log` does not error even if it does not recognize the template.
      getLogger('nuclide-hg-rpc').error(
        `Failed when trying to get differential revision for: ${changeSetId}`,
      );
      return null;
    }
  }

  /**
   * Get the output of the experimental smartlog extension from Mercurial:
   * https://bitbucket.org/facebook/hg-experimental/#markdown-header-smartlog.
   * @param ttyOutput If true, return the output as if stdout were attached to a tty.
   * @param concise true to run `hg smartlog`; false to run `hg ssl`.
   * @return The output from running the command.
   */
  async getSmartlog(
    ttyOutput: boolean,
    concise: boolean,
  ): Promise<AsyncExecuteRet> {
    // disable the pager extension so that 'hg ssl' terminates. We can't just use
    // HGPLAIN because we have not found a way to get colored output when we do.
    const args = [
      '--config',
      'extensions.pager=!',
      concise ? 'ssl' : 'smartlog',
    ];
    const execOptions = {
      cwd: this._workingDirectory,
      NO_HGPLAIN: concise, // `hg ssl` is likely user-defined.
      TTY_OUTPUT: ttyOutput,
    };
    return this._hgAsyncExecute(args, execOptions);
  }

  _commitCode(
    message: ?string,
    args: Array<string>,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    let editMergeConfigs;
    return Observable.fromPromise(
      (async () => {
        // prevent user-specified merge tools from attempting to
        // open interactive editors
        args.push('--config', 'ui.merge=:merge');
        if (message == null) {
          return args;
        } else {
          return [...args, '-m', formatCommitMessage(message)];
        }
      })(),
    ).switchMap(argumentsWithCommitFile => {
      const execArgs = argumentsWithCommitFile;
      const execOptions: HgExecOptions = {
        cwd: this._workingDirectory,
      };
      if (editMergeConfigs != null) {
        execArgs.push(...editMergeConfigs.args);
        execOptions.HGEDITOR = editMergeConfigs.hgEditor;
      }
      return this._hgObserveExecution(execArgs, execOptions);
    });
  }

  /**
   * Commit code to version control.
   * @param message Commit message.
   * @param filePaths List of changed files to commit. If empty, all will be committed
   */
  commit(
    message: string,
    filePaths: Array<NuclideUri> = [],
  ): ConnectableObservable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this._commitCode(message, ['commit', ...filePaths]).publish();
  }

  /**
   * Amend code changes to the latest commit.
   * @param message Commit message.  Message will remain unchaged if not provided.
   * @param amendMode Decide the amend functionality to apply.
   *  Clean to just amend.
   *  Rebase to amend and rebase the stacked diffs.
   *  Fixup to fix the stacked commits, rebasing them on top of this commit.
   * @param filePaths List of changed files to commit. If empty, all will be committed
   */
  amend(
    message: ?string,
    amendMode: AmendModeValue,
    filePaths: Array<NuclideUri> = [],
  ): ConnectableObservable<LegacyProcessMessage> {
    // TODO(T17463635)
    const args = ['amend', ...filePaths];
    switch (amendMode) {
      case AmendMode.CLEAN:
        break;
      case AmendMode.REBASE:
        args.push('--rebase');
        break;
      case AmendMode.FIXUP:
        args.push('--fixup');
        break;
      default:
        throw new Error('Unexpected AmendMode');
    }
    return this._commitCode(message, args).publish();
  }

  splitRevision(): ConnectableObservable<LegacyProcessMessage> {
    // TODO(T17463635)
    let editMergeConfigs;
    return Observable.fromPromise(
      (async () => {
        editMergeConfigs = await getInteractiveCommitEditorConfig();
      })(),
    )
      .switchMap(() => {
        invariant(editMergeConfigs != null, 'editMergeConfigs cannot be null');
        const execOptions = {
          cwd: this._workingDirectory,
          HGEDITOR: editMergeConfigs.hgEditor,
        };
        return this._hgObserveExecution(
          [...editMergeConfigs.args, 'split'],
          execOptions,
        );
      })
      .publish();
  }

  revert(filePaths: Array<NuclideUri>, toRevision: ?string): Promise<void> {
    const args = [...filePaths];
    if (toRevision != null) {
      args.push('--rev', toRevision);
    }
    return this._runSimpleInWorkingDirectory('revert', args);
  }

  async _runSimpleInWorkingDirectory(
    action: string,
    args: Array<string>,
  ): Promise<void> {
    const options = {
      cwd: this._workingDirectory,
    };
    const cmd = [action].concat(args);
    try {
      await this._hgAsyncExecute(cmd, options);
    } catch (e) {
      const errorString = e.stderr || e.message || e.toString();
      getLogger('nuclide-hg-rpc').error(
        'hg %s failed with [%s] arguments: %s',
        action,
        args.toString(),
        errorString,
      );
      throw new Error(errorString);
    }
  }

  /**
   * @param revision This could be a changeset ID, name of a bookmark, revision number, etc.
   * @param create Currently, this parameter is ignored.
   * @param options.
   */
  checkout(
    revision: string,
    create: boolean,
    options?: CheckoutOptions,
  ): ConnectableObservable<LegacyProcessMessage> {
    // TODO(T17463635)
    const args = ['checkout', revision];
    if (options && options.clean) {
      args.push('--clean');
    }
    const executionOptions = {
      cwd: this._workingDirectory,
    };
    return hgObserveExecution(args, executionOptions)
      .switchMap(processExitCodeAndThrow)
      .publish();
  }

  show(revision: number): ConnectableObservable<RevisionShowInfo> {
    const args = ['show', `${revision}`, '-Tjson'];
    const execOptions = {
      cwd: this._workingDirectory,
    };
    return hgRunCommand(args, execOptions)
      .map(stdout => {
        return JSON.parse(stdout)[0];
      })
      .publish();
  }

  /**
   * Removes files not tracked by Mercurial.
   */
  purge(): Promise<void> {
    return this._runSimpleInWorkingDirectory('purge', []);
  }

  /**
   * Undoes the effect of a local commit, specifically the working directory parent.
   */
  uncommit(): Promise<void> {
    return this._runSimpleInWorkingDirectory('reset', ['--rev', '.^']);
  }

  /**
   * @param revision This could be a changeset ID, name of a bookmark, revision number, etc.
   */
  strip(revision: string): Promise<void> {
    return this._runSimpleInWorkingDirectory('strip', [revision]);
  }

  /**
   * @param revision This could be a changeset ID, name of a bookmark, revision number, etc.
   * @param create Currently, this parameter is ignored.
   */
  async checkoutForkBase(): Promise<void> {
    const forkBaseName = await getForkBaseName(this._workingDirectory);
    await this._runSimpleInWorkingDirectory('checkout', [forkBaseName]);
  }

  /*
   * Silence errors from hg calls that don't include any tracked files - these
   * are generally harmless and should not create an error notification.
   * This checks the error string in order to avoid potentially slow hg pre-checks.
   */
  _rethrowErrorIfHelpful(e: Error): void {
    if (!IGNORABLE_ERROR_SUFFIXES.some(s => e.message.endsWith(s + '\n'))) {
      throw e;
    }
  }

  /**
   * Rename/move files versioned under Hg.
   * @param filePaths Which files should be renamed/moved.
   * @param destPath What should the file be renamed/moved to.
   */
  async rename(
    filePaths: Array<NuclideUri>,
    destPath: NuclideUri,
    after?: boolean,
  ): Promise<void> {
    const args = [
      ...filePaths.map(p => nuclideUri.getPath(p)), // Sources
      nuclideUri.getPath(destPath), // Dest
    ];
    if (after) {
      args.unshift('--after');
    }
    try {
      await this._runSimpleInWorkingDirectory('rename', args);
    } catch (e) {
      if (after) {
        this._rethrowErrorIfHelpful(e);
      } else {
        throw e;
      }
    }
  }

  /**
   * Remove a file versioned under Hg.
   * @param filePath Which file should be removed.
   */
  async remove(filePaths: Array<NuclideUri>, after?: boolean): Promise<void> {
    const args = ['-f', ...filePaths.map(p => nuclideUri.getPath(p))];
    if (after) {
      args.unshift('--after');
    }

    try {
      await this._runSimpleInWorkingDirectory('remove', args);
    } catch (e) {
      if (after) {
        this._rethrowErrorIfHelpful(e);
      } else {
        throw e;
      }
    }
  }

  /**
   * Mark the specified files so they will no longer be tracked by hg after the next commit.
   * The file will remain in the working directory.
   * @param filePath Which file(s) should be forgotten.
   */
  async forget(filePaths: Array<NuclideUri>): Promise<void> {
    const args = [...filePaths.map(p => nuclideUri.getPath(p))];
    try {
      await this._runSimpleInWorkingDirectory('forget', args);
    } catch (e) {
      throw e;
    }
  }

  /**
   * Version a new file under Hg.
   * @param filePath Which file should be versioned.
   */
  add(filePaths: Array<NuclideUri>): Promise<void> {
    return this._runSimpleInWorkingDirectory('add', filePaths);
  }

  async getTemplateCommitMessage(): Promise<?string> {
    const args = ['debugcommitmessage'];
    const execOptions = {
      cwd: this._workingDirectory,
    };

    try {
      const {stdout} = await this._hgAsyncExecute(args, execOptions);
      return stdout;
    } catch (e) {
      getLogger('nuclide-hg-rpc').error(
        'Failed when trying to get template commit message',
      );
      return null;
    }
  }

  async getHeadCommitMessage(): Promise<?string> {
    const args = [
      'log',
      '-T',
      '{desc}\n',
      '--limit',
      '1',
      '--rev',
      expressionForRevisionsBeforeHead(0),
    ];
    const execOptions = {
      cwd: this._workingDirectory,
    };
    try {
      const output = await this._hgAsyncExecute(args, execOptions);
      const stdout = output.stdout.trim();
      return stdout || null;
    } catch (e) {
      // This should not happen: `hg log` does not error even if it does not recognize the template.
      getLogger('nuclide-hg-rpc').error(
        'Failed when trying to get head commit message',
      );
      return null;
    }
  }

  async log(
    filePaths: Array<NuclideUri>,
    limit?: ?number,
  ): Promise<VcsLogResponse> {
    const args = ['log', '-Tjson'];
    if (limit != null && limit > 0) {
      args.push('--limit', String(limit));
    }
    for (const filePath of filePaths) {
      args.push(filePath);
    }

    const execOptions = {
      cwd: this._workingDirectory,
    };
    const result = await this._hgAsyncExecute(args, execOptions);
    const entries = JSON.parse(result.stdout);
    return {entries};
  }

  fetchMergeConflictsWithDetails(): ConnectableObservable<?MergeConflictsEnriched> {
    const args = ['resolve', '--tool=internal:dumpjson', '--all'];
    const execOptions = {
      cwd: this._workingDirectory,
    };
    return (
      this._hgRunCommand(args, execOptions)
        .map(data => {
          const parsedData = JSON.parse(data)[0];
          if (parsedData.command == null) {
            return null;
          }
          const conflicts = parsedData.conflicts.map(conflict => {
            const {local, other} = conflict;
            let status;
            if (local.exists && other.exists) {
              status = MergeConflictStatus.BOTH_CHANGED;
            } else if (local.exists) {
              status = MergeConflictStatus.DELETED_IN_THEIRS;
            } else {
              status = MergeConflictStatus.DELETED_IN_OURS;
            }

            return {
              ...conflict,
              status,
            };
          });
          return {
            ...parsedData,
            conflicts,
          };
        })
        // `resolve --all` returns a non-zero exit code when there's no conflicts.
        .catch(() => Observable.of(null))
        .publish()
    );
  }

  /*
   * Setting fetchResolved will return all resolved and unresolved conflicts,
   * the default would only fetch the current unresolved conflicts.
   */
  async fetchMergeConflicts(
    fetchResolved: ?boolean,
  ): Promise<Array<MergeConflict>> {
    const {stdout} = await this._hgAsyncExecute(
      ['resolve', '--list', '-Tjson'],
      {
        cwd: this._workingDirectory,
      },
    );
    const fileListStatuses = JSON.parse(stdout);
    const resolvedFiles = fetchResolved
      ? fileListStatuses
          .filter(
            fileStatus =>
              fileStatus.status === MergeConflictFileStatus.RESOLVED,
          )
          .map(fileStatus => ({
            path: fileStatus.path,
            status: MergeConflictStatus.RESOLVED,
          }))
      : [];
    const conflictedFiles = fileListStatuses.filter(fileStatus => {
      return fileStatus.status === MergeConflictFileStatus.UNRESOLVED;
    });
    const origBackupPath = await this._getOrigBackupPath();
    const conflicts = await Promise.all(
      conflictedFiles.map(async conflictedFile => {
        let status;
        // Heuristic: If the `.orig` file doesn't exist, then it's deleted by the rebasing commit.
        if (await this._checkOrigFile(origBackupPath, conflictedFile.path)) {
          status = MergeConflictStatus.BOTH_CHANGED;
        } else {
          status = MergeConflictStatus.DELETED_IN_THEIRS;
        }
        return {
          path: conflictedFile.path,
          status,
        };
      }),
    );
    return [...conflicts, ...resolvedFiles];
  }

  async _getOrigBackupPath(): Promise<string> {
    if (this._origBackupPath == null) {
      const relativeBackupPath = await this.getConfigValueAsync(
        'ui.origbackuppath',
      );
      if (relativeBackupPath == null) {
        this._origBackupPath = this._workingDirectory;
      } else {
        this._origBackupPath = nuclideUri.join(
          this._workingDirectory,
          relativeBackupPath,
        );
      }
    }
    return this._origBackupPath;
  }

  async _checkOrigFile(
    origBackupPath: string,
    filePath: string,
  ): Promise<boolean> {
    const origFilePath = nuclideUri.join(origBackupPath, `${filePath}.orig`);
    logger.info('origBackupPath:', origBackupPath);
    logger.info('filePath:', filePath);
    logger.info('origFilePath:', origFilePath);
    return fsPromise.exists(origFilePath);
  }

  markConflictedFile(
    filePath: NuclideUri,
    resolved: boolean,
  ): ConnectableObservable<LegacyProcessMessage> {
    // TODO(T17463635)
    // -m marks file as resolved, -u marks file as unresolved
    const fileStatus = resolved ? '-m' : '-u';
    const args = ['resolve', fileStatus, filePath];
    const execOptions = {
      cwd: this._workingDirectory,
    };
    return this._hgObserveExecution(args, execOptions)
      .switchMap(processExitCodeAndThrow)
      .publish();
  }

  continueOperation(
    command: string,
  ): ConnectableObservable<LegacyProcessMessage> {
    // TODO(T17463635)

    // prevent user-specified merge tools from attempting to
    // open interactive editors
    const args = [command, '--continue', '--config', 'ui.merge=:merge'];
    const execOptions = {
      cwd: this._workingDirectory,
    };
    return this._hgObserveExecution(args, execOptions)
      .switchMap(processExitCodeAndThrow)
      .publish();
  }

  abortOperation(command: string): ConnectableObservable<string> {
    const args = [command, '--abort'];
    const execOptions = {
      cwd: this._workingDirectory,
    };
    return hgRunCommand(args, execOptions).publish();
  }

  rebase(
    destination: string,
    source?: string,
  ): ConnectableObservable<LegacyProcessMessage> {
    // TODO(T17463635)

    // prevent user-specified merge tools from attempting to
    // open interactive editors
    const args = ['rebase', '-d', destination, '--config', 'ui.merge=:merge'];
    if (source != null) {
      args.push('-s', source);
    }
    const execOptions = {
      cwd: this._workingDirectory,
      // Setting the editor to a non-existant tool to prevent operations that rely
      // on the user's default editor from attempting to open up when needed.
    };
    return this._hgObserveExecution(args, execOptions).publish();
  }

  pull(options: Array<string>): ConnectableObservable<LegacyProcessMessage> {
    // TODO(T17463635)
    const args = ['pull', ...options];
    const execOptions = {
      cwd: this._workingDirectory,
    };

    return this._hgObserveExecution(args, execOptions).publish();
  }

  /**
   * Copy files versioned under Hg.
   * @param filePaths Which files should be copied.
   * @param destPath What should the new file be named to.
   */
  async copy(
    filePaths: Array<NuclideUri>,
    destPath: NuclideUri,
    after?: boolean,
  ): Promise<void> {
    const args = [
      ...filePaths.map(p => nuclideUri.getPath(p)), // Sources
      nuclideUri.getPath(destPath), // Dest
    ];
    if (after) {
      args.unshift('--after');
    }
    try {
      await this._runSimpleInWorkingDirectory('copy', args);
    } catch (e) {
      if (after) {
        this._rethrowErrorIfHelpful(e);
      } else {
        throw e;
      }
    }
  }
}
