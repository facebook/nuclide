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
import type {DeadlineRequest} from 'nuclide-commons/promise';
import type {AdditionalLogFile} from '../../nuclide-logging/lib/rpc-types';
import type {HgExecOptions} from './hg-exec-types';
import type {
  MergeConflicts,
  VcsLogResponse,
  RevisionShowInfo,
  CheckoutOptions,
  AsyncExecuteRet,
  RevisionFileChanges,
  RevisionInfo,
  DiffInfo,
  AmendModeValue,
  BookmarkInfo,
  StatusCodeIdValue,
} from './types';

import {takeIterable} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {fastDebounce} from 'nuclide-commons/observable';
import {timeoutAfterDeadline} from 'nuclide-commons/promise';
import {stringifyError} from 'nuclide-commons/string';
import {WatchmanClient} from 'nuclide-watchman-helpers';
import {gitDiffStrings as gitDiffStringsImpl} from './git-diff';
import fs from 'fs';

import {
  MergeConflictStatus,
  HisteditActions,
  LockFilesList,
} from './hg-constants';
import {Subject, ReplaySubject} from 'rxjs';
import {parseMultiFileHgDiffUnifiedOutput} from './hg-diff-output-parser';
import {
  expressionForCommonAncestor,
  expressionForRevisionsBeforeHead,
  fetchRevisionInfoBetweenRevisions,
  fetchRevisionInfo,
  fetchHeadRevisionInfo as fetchHeadRevisionInfoImpl,
  fetchRevisionsInfo,
  fetchSmartlogRevisions as fetchSmartlogRevisionsImpl,
} from './hg-revision-expression-helpers';
import * as StateHelpers from './hg-revision-state-helpers';
import {
  formatCommitMessage,
  hgAsyncExecute,
  hgObserveExecution,
  hgRunCommand,
} from './hg-utils';
import fsPromise from 'nuclide-commons/fsPromise';
import debounce from 'nuclide-commons/debounce';

import * as BookmarkHelpers from './hg-bookmark-helpers';
import {getLogger} from 'log4js';
import {Observable} from 'rxjs';
import {
  subscribeToFilesCreateAndDelete,
  getFilesInstantaneousExistance,
} from './watchFileCreationAndDeletion';

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
const WATCHMAN_SUBSCRIPTION_NAME_PROGRESS =
  'hg-repository-watchman-subscription-progress';
const WATCHMAN_SUBSCRIPTION_NAME_LOCK_FILES =
  'hg-repository-watchman-subscription-lock-files';

const CHECK_CONFLICT_DELAY_MS = 2000;
const COMMIT_CHANGE_DEBOUNCE_MS = 1000;

// If Watchman reports that many files have changed, it's not really useful to report this.
// This is typically caused by a large rebase or a Watchman re-crawl.
// We'll just report that the repository state changed, which should trigger a full client refresh.
const FILES_CHANGED_LIMIT = 1000;
const NUM_FETCH_STATUSES_LIMIT = 200;

// Suffixes of hg error messages that indicate that an error is safe to ignore,
// and should not warrant a user-visible error. These generally happen
// when performing an hg operation on a non-existent or untracked file.
const IGNORABLE_ERROR_SUFFIXES = [
  'abort: no files to copy',
  'No such file or directory',
  'does not exist!',
  // Windows version of 'no such file or directory':
  'The system cannot find the file specified',
];

const DEFAULT_HG_COMMIT_TITLE_REGEX = /^<Replace this line with a title. Use 1 line only, 67 chars or less>/;

async function logWhenSubscriptionEstablished(
  sub: Promise<mixed>,
  subName: string,
): Promise<void> {
  await sub;
  logger.debug(`Watchman subscription ${subName} established.`);
}

async function getForkBaseName(directoryPath: string): Promise<string> {
  try {
    // $FlowFB
    const {readArcConfig} = require('../../fb-arcanist-rpc');
    const arcConfig = await readArcConfig(directoryPath);
    if (arcConfig != null) {
      return (
        arcConfig['arc.feature.start.default'] ||
        arcConfig['arc.land.onto.default'] ||
        DEFAULT_ARC_PROJECT_FORK_BASE
      );
    }
  } catch (err) {}
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

function resolvePathForPlatform(path: string): string {
  // hg resolve on win has a bug where it returns path with both unix
  // and win separators (T22157755). We normalize the path here.
  if (process.platform === 'win32') {
    return path.replace(/\//g, '\\');
  }
  return path;
}

/** @return .hg/store directory for the specified Hg working directory root. */
async function findStoreDirectory(workingDirectory: string): Promise<string> {
  // If .hg/sharedpath is present, then this directory is using the Hg "share"
  // extension, in which case it is sharing the store with the .hg folder
  // specified by .hg/sharedpath.
  //
  // Note that we could be extra paranoid and watch for changes to
  // .hg/sharedpath, but that seems too rare to be worth the extra complexity.
  const sharedpath = nuclideUri.join(workingDirectory, '.hg', 'sharedpath');
  let hgFolderWithStore;
  try {
    hgFolderWithStore = await fsPromise.readFile(sharedpath, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      // .hg/sharedpath does not exist: use .hg in workingDirectory.
      hgFolderWithStore = nuclideUri.join(workingDirectory, '.hg');
    } else {
      throw error;
    }
  }

  return nuclideUri.join(hgFolderWithStore, 'store');
}

export class HgRepositorySubscriptions {
  _isInConflict: boolean;
  _watchmanClient: ?WatchmanClient;
  _origBackupPath: ?string;

  _workingDirectory: string;
  _filesDidChangeObserver: Subject<any>;
  _hgActiveBookmarkDidChangeObserver: Subject<any>;
  _lockFilesDidChange: Observable<Map<string, boolean>>;
  _watchmanHealth: Observable<boolean>;
  _hgBookmarksDidChangeObserver: Subject<any>;
  _hgRepoStateDidChangeObserver: Subject<any>;
  _hgRepoCommitsDidChangeObserver: Subject<void>;
  _hgConflictStateDidChangeObserver: Subject<boolean>;
  _hgOperationProgressDidChangeObserver: Subject<void>;
  _debouncedCheckConflictChange: () => void;
  _hgStoreDirWatcher: ?fs.FSWatcher;
  _disposeObserver: Subject<void>; // used to limit lifespan of other observables

  static async create(
    workingDirectory: string,
  ): Promise<HgRepositorySubscriptions> {
    const repoSubscriptions = new HgRepositorySubscriptions(workingDirectory);
    await repoSubscriptions._subscribeToWatchman();
    return repoSubscriptions;
  }

  // DO NOT USE DIRECTLY: Use the static `create` instead.
  constructor(workingDirectory: string) {
    this._workingDirectory = workingDirectory;
    this._filesDidChangeObserver = new Subject();
    this._hgActiveBookmarkDidChangeObserver = new Subject();
    this._lockFilesDidChange = Observable.empty();
    this._watchmanHealth = Observable.empty();
    this._hgBookmarksDidChangeObserver = new Subject();
    this._hgRepoStateDidChangeObserver = new Subject();
    this._hgConflictStateDidChangeObserver = new Subject();
    this._hgRepoCommitsDidChangeObserver = new Subject();
    this._hgOperationProgressDidChangeObserver = new Subject();
    this._isInConflict = false;
    this._debouncedCheckConflictChange = debounce(() => {
      this._checkConflictChange();
    }, CHECK_CONFLICT_DELAY_MS);
    this._disposeObserver = new ReplaySubject();
  }

  async dispose(): Promise<void> {
    this._disposeObserver.next();
    this._disposeObserver.complete();
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

    const progressSubscriptionPromise = watchmanClient.watchDirectoryRecursive(
      workingDirectory,
      WATCHMAN_SUBSCRIPTION_NAME_PROGRESS,
      {
        fields: ['name'],
        expression: ['name', '.hg/progress', 'wholename'],
        empty_on_fresh_instance: true,
        defer_vcs: false,
      },
    );
    logWhenSubscriptionEstablished(
      progressSubscriptionPromise,
      WATCHMAN_SUBSCRIPTION_NAME_PROGRESS,
    );

    this._lockFilesDidChange = subscribeToFilesCreateAndDelete(
      watchmanClient,
      workingDirectory,
      LockFilesList,
      WATCHMAN_SUBSCRIPTION_NAME_LOCK_FILES,
    )
      .publish()
      .refCount();

    this._watchmanHealth = watchmanClient.observeHealth();

    // Those files' changes indicate a commit-changing action has been applied to the repository,
    // Watchman currently (v4.7) ignores `.hg/store` file updates.
    // Hence, we here use node's filesystem watchers instead.
    const hgStoreDirectory = await findStoreDirectory(workingDirectory);
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
      progressSubscription,
    ] = await Promise.all([
      primarySubscriptionPromise,
      hgActiveBookmarkSubscriptionPromise,
      hgBookmarksSubscriptionPromise,
      dirStateSubscriptionPromise,
      conflictStateSubscriptionPromise,
      progressSubscriptionPromise,
    ]);

    primarySubscription.on('change', this._filesDidChange.bind(this));
    hgActiveBookmarkSubscription.on(
      'change',
      this._hgActiveBookmarkDidChange.bind(this),
    );
    hgBookmarksSubscription.on('change', this._hgBookmarksDidChange.bind(this));
    dirStateSubscription.on('change', this._emitHgRepoStateChanged.bind(this));
    conflictStateSubscription.on('change', this._debouncedCheckConflictChange);
    progressSubscription.on(
      'change',
      this._hgOperationProgressDidChange.bind(this),
    );
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
    this._isInConflict = mergeDirectoryExists;
    this._hgConflictStateDidChangeObserver.next(mergeDirectoryExists);
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

  _hgOperationProgressDidChange(): void {
    this._hgOperationProgressDidChangeObserver.next();
  }

  observeWatchmanHealth(): ConnectableObservable<boolean> {
    return this._watchmanHealth.takeUntil(this._disposeObserver).publish();
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
        .let(fastDebounce(COMMIT_CHANGE_DEBOUNCE_MS))
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
   * Observes when the Mercurial operation progress has changed
   */
  observeHgOperationProgressDidChange(): ConnectableObservable<any> {
    return this._hgOperationProgressDidChangeObserver
      .let(fastDebounce(50))
      .switchMap(() =>
        Observable.fromPromise(
          fsPromise.readFile(
            nuclideUri.join(this._workingDirectory, '.hg', 'progress'),
            'utf8',
          ),
        )
          .catch(() => {
            getLogger('nuclide-hg-rpc').error(
              '.hg/progress changed but could not be read',
            );
            return Observable.empty();
          })
          .filter(content => content.length > 0)
          .map(content => JSON.parse(content))
          .catch(() => {
            getLogger('nuclide-hg-rpc').error(
              '.hg/progress changed but its contents could not be parsed as JSON',
            );
            return Observable.empty();
          }),
      )
      .publish();
  }

  /**
   * Observes that the active Mercurial bookmark has changed.
   */
  observeActiveBookmarkDidChange(): ConnectableObservable<void> {
    return this._hgActiveBookmarkDidChangeObserver.publish();
  }

  /**
   * Observes that the Mercurial working directory lock has changed.
   */
  observeLockFilesDidChange(): ConnectableObservable<Map<string, boolean>> {
    return this._lockFilesDidChange.takeUntil(this._disposeObserver).publish();
  }

  /**
   * Observes that Mercurial bookmarks have changed.
   */
  observeBookmarksDidChange(): ConnectableObservable<void> {
    return this._hgBookmarksDidChangeObserver.publish();
  }
}

export function createRepositorySubscriptions(
  workingDirectory: NuclideUri,
): Promise<HgRepositorySubscriptions> {
  return HgRepositorySubscriptions.create(workingDirectory);
}

/**
 * Section: File and Repository Status
 */

/**
 * Shells out of the `hg status` to get the statuses of the paths.
 */
export function fetchStatuses(
  workingDirectory: NuclideUri,
  toRevision?: string,
): ConnectableObservable<Map<NuclideUri, StatusCodeIdValue>> {
  const execOptions = {
    cwd: workingDirectory,
  };
  const args = ['status', '-Tjson'];
  if (toRevision != null) {
    args.push('--rev', toRevision);
  }

  return hgRunCommand(args, execOptions)
    .map(stdout => {
      const statusMap = new Map();
      const statuses = JSON.parse(stdout);
      for (const status of takeIterable(statuses, NUM_FETCH_STATUSES_LIMIT)) {
        statusMap.set(
          nuclideUri.join(workingDirectory, status.path),
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
export function fetchStackStatuses(
  workingDirectory: NuclideUri,
): ConnectableObservable<Map<NuclideUri, StatusCodeIdValue>> {
  // Note: an alternative which doesn't depend upon reading .arcconfig in getForkBaseName is:
  //   return fetchStatuses(workingDirectory, ('ancestor(ancestor((not public()) and (:: .))^ or .)')
  // Both the code below and the alternative above have identical performance.

  return Observable.fromPromise(getForkBaseName(workingDirectory)) // e.g. "master"
    .switchMap(forkBaseName => {
      const root = expressionForCommonAncestor(forkBaseName); // e.g. "ancestor(master, .)"
      return fetchStatuses(workingDirectory, root).refCount();
    })
    .publish();
}

/**
 * Like fetchStatuses, but first checks whether the head is public. If so, returns
 * changes *since* the head. If not, returns changes *including* the head.
 */
export function fetchHeadStatuses(
  workingDirectory: NuclideUri,
): ConnectableObservable<Map<NuclideUri, StatusCodeIdValue>> {
  return fetchStatuses(
    workingDirectory,
    'ancestor(. or (. and (not public()))^)',
  );
}

export async function getAdditionalLogFiles(
  workingDirectory: NuclideUri,
  deadline: DeadlineRequest,
): Promise<Array<AdditionalLogFile>> {
  const options = {cwd: workingDirectory};
  const base = await timeoutAfterDeadline(
    deadline,
    getForkBaseName(workingDirectory),
  ); // e.g. master
  const root = expressionForCommonAncestor(base); // ancestor(master, .)

  // The ID of the root
  const getId = async () => {
    try {
      const args = ['id', '--rev', root];
      const output = await hgAsyncExecute(args, options);
      return output.stdout ? output.stdout.trim() : '<id unknown>';
    } catch (e) {
      return `<id error: ${e.stderr}`;
    }
  };

  // Diff from base to current working directory
  const getDiff = async () => {
    try {
      const args = ['diff', '--unified', '0', '-r', root];
      const output = await hgAsyncExecute(args, options);
      return output.stdout ? output.stdout.trim() : '<diff unknown>';
    } catch (e) {
      return `<diff error: ${e.stderr}>`;
    }
  };

  // Summary of changes from base to current working directory
  const getStatus = async () => {
    const statuses = await fetchStatuses(workingDirectory, root)
      .refCount()
      .toPromise();
    let result = '';
    for (const [filepath, status] of statuses) {
      result += `${status} ${filepath}\n`;
    }
    return result;
  };

  const [id, hgDiff, status] = await Promise.all([
    timeoutAfterDeadline(deadline, getId()).catch(
      e => `id ${e.message}\n${e.stack}`,
    ),
    timeoutAfterDeadline(deadline, getDiff()).catch(
      e => 'diff ' + stringifyError(e),
    ),
    timeoutAfterDeadline(deadline, getStatus()).catch(
      e => 'status ' + stringifyError(e),
    ),
  ]);

  const results: Array<AdditionalLogFile> = [];

  // If the user is on a public revision, there's no need to provide hgdiff.
  results.push({
    title: `${workingDirectory}:hg`,
    data:
      `hg update -r ${id}\n` +
      (status === '' ? '' : 'hg import --no-commit hgdiff\n') +
      `\n${status}`,
  });
  if (status !== '') {
    results.push({
      title: `${workingDirectory}:hgdiff`,
      data: hgDiff,
    });
  }

  return results;
}

/**
 * Shells out to `hg diff` to retrieve line diff information for the paths.
 * @param An Array of NuclideUri (absolute paths) for which to fetch diff info.
 * @return A map of each NuclideUri (absolute path) to its DiffInfo.
 *   Each path is presumed to be in the repo.
 *   If the `hg diff` call fails, this method returns null.
 *   If a path has no changes, it will not appear in the returned Map.
 */
export async function fetchDiffInfo(
  workingDirectory: NuclideUri,
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
    cwd: workingDirectory,
  };
  let output;
  try {
    output = await hgAsyncExecute(args, options);
  } catch (e) {
    getLogger('nuclide-hg-rpc').error(
      `Error when running hg diff for paths: ${filePaths.toString()} \n\tError: ${
        e.stderr
      }`,
    );
    return null;
  }
  const pathToDiffInfo = parseMultiFileHgDiffUnifiedOutput(output.stdout);
  const absolutePathToDiffInfo = new Map();
  for (const [filePath, diffInfo] of pathToDiffInfo) {
    absolutePathToDiffInfo.set(
      nuclideUri.join(workingDirectory, filePath),
      diffInfo,
    );
  }
  return absolutePathToDiffInfo;
}

export function getLockFilesInstantaneousExistance(
  workingDirectory: string,
): Promise<Map<string, boolean>> {
  return getFilesInstantaneousExistance(
    workingDirectory,
    LockFilesList,
  ).toPromise();
}

/**
 * Section: Bookmarks
 */

export function createBookmark(
  workingDirectory: NuclideUri,
  name: string,
  revision: ?string,
): Promise<void> {
  const args = [];
  // flowlint-next-line sketchy-null-string:off
  if (revision) {
    args.push('--rev', revision);
  }
  args.push(name);

  return _runSimpleInWorkingDirectory(workingDirectory, 'bookmark', args);
}

export function deleteBookmark(
  workingDirectory: NuclideUri,
  name: string,
): Promise<void> {
  return _runSimpleInWorkingDirectory(workingDirectory, 'bookmarks', [
    '--delete',
    name,
  ]);
}

export function renameBookmark(
  workingDirectory: NuclideUri,
  name: string,
  nextName: string,
): Promise<void> {
  return _runSimpleInWorkingDirectory(workingDirectory, 'bookmarks', [
    '--rename',
    name,
    nextName,
  ]);
}

/**
 * @return The name of the current bookmark.
 */
export function fetchActiveBookmark(
  workingDirectory: NuclideUri,
): Promise<string> {
  return BookmarkHelpers.fetchActiveBookmark(
    nuclideUri.join(workingDirectory, '.hg'),
  );
}

/**
 * @return An Array of bookmarks for this repository.
 */
export function fetchBookmarks(
  workingDirectory: NuclideUri,
): Promise<Array<BookmarkInfo>> {
  return BookmarkHelpers.fetchBookmarks(
    nuclideUri.join(workingDirectory, '.hg'),
  );
}

/**
 * Section: Repository State at Specific Revisions
 */

/**
 * @param filePath: The full path to the file of interest.
 * @param revision: An expression that hg can understand, specifying the
 * revision at which we want to see the file content.
 */
export function fetchFileContentAtRevision(
  workingDirectory: NuclideUri,
  filePath: NuclideUri,
  revision: string,
): ConnectableObservable<string> {
  return StateHelpers.fetchFileContentAtRevision(
    filePath,
    revision,
    workingDirectory,
  );
}

export function batchFetchFileContentsAtRevision(
  workingDirectory: NuclideUri,
  filePaths: Array<NuclideUri>,
  revision: string,
): ConnectableObservable<Map<NuclideUri, string>> {
  return StateHelpers.batchFetchFileContentsAtRevision(
    filePaths,
    revision,
    workingDirectory,
  );
}

export function fetchFilesChangedAtRevision(
  workingDirectory: NuclideUri,
  revision: string,
): ConnectableObservable<RevisionFileChanges> {
  return StateHelpers.fetchFilesChangedAtRevision(revision, workingDirectory);
}

/**
 * Fetch the revision details between the current head and the the common ancestor
 * of head and master in the repository.
 * @return an array with the revision info (`title`, `author`, `date` and `id`)
 * or `null` if no common ancestor was found.
 */
export async function fetchRevisionInfoBetweenHeadAndBase(
  workingDirectory: NuclideUri,
): Promise<Array<RevisionInfo>> {
  const forkBaseName = await getForkBaseName(workingDirectory);
  const revisionsInfo = await fetchRevisionInfoBetweenRevisions(
    expressionForCommonAncestor(forkBaseName),
    expressionForRevisionsBeforeHead(0),
    workingDirectory,
  );
  return revisionsInfo;
}

export function fetchHeadRevisionInfo(
  workingDirectory: NuclideUri,
): ConnectableObservable<Array<RevisionInfo>> {
  return fetchHeadRevisionInfoImpl(workingDirectory);
}

export function fetchSmartlogRevisions(
  workingDirectory: NuclideUri,
): ConnectableObservable<Array<RevisionInfo>> {
  return fetchSmartlogRevisionsImpl(workingDirectory);
}

/**
 * Resolve the revision details of the base branch
 */
export async function getBaseRevision(
  workingDirectory: NuclideUri,
): Promise<RevisionInfo> {
  const forkBaseName = await getForkBaseName(workingDirectory);
  return fetchRevisionInfo(
    expressionForCommonAncestor(forkBaseName),
    workingDirectory,
  );
}

/**
 * Gets the blame for the filePath at the current revision.
 * It returns null for uncommitted changes (but cannot detect unsaved changes)
 * @param filePath The file to get blame information for.
 * @return An Array that maps a line number (0-indexed) to the revision info.
 */
export async function getBlameAtHead(
  workingDirectory: NuclideUri,
  filePath: NuclideUri,
): Promise<Array<?RevisionInfo>> {
  let revisionsByLine;
  try {
    revisionsByLine = (await hgAsyncExecute(
      [
        'blame',
        '-c', // Query the hash
        '-T',
        '{lines % "{node|short}\n"}', // Just display the hash per line
        '-r',
        'wdir()', // Blank out uncommitted changes
        filePath,
      ],
      {cwd: workingDirectory},
    )).stdout.split('\n');
  } catch (e) {
    getLogger('nuclide-hg-rpc').error(
      `LocalHgServiceBase failed to fetch blame for file: ${filePath}. Error: ${
        e.stderr
      }`,
    );
    throw e;
  }

  const uniqueRevisions = [...(new Set(revisionsByLine.filter(e => e)): any)];

  let revisionsArray;
  try {
    revisionsArray = await fetchRevisionsInfo(
      uniqueRevisions.join('+'),
      workingDirectory,
      {hidden: true, shouldLimit: false},
    ).toPromise();
  } catch (e) {
    getLogger('nuclide-hg-rpc').error(
      `LocalHgServiceBase failed to fetch blame for file: ${filePath}. Error: ${
        e.stderr
      }`,
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
export async function getConfigValueAsync(
  workingDirectory: NuclideUri,
  key: string,
): Promise<?string> {
  const args = ['config', key];
  const execOptions = {
    cwd: workingDirectory,
  };
  try {
    return (await hgAsyncExecute(args, execOptions)).stdout.trim();
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
export async function getDifferentialRevisionForChangeSetId(
  workingDirectory: NuclideUri,
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
    cwd: workingDirectory,
  };
  try {
    const output = await hgAsyncExecute(args, execOptions);
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
export async function getSmartlog(
  workingDirectory: NuclideUri,
  ttyOutput: boolean,
  concise: boolean,
): Promise<AsyncExecuteRet> {
  // disable the pager extension so that 'hg ssl' terminates. We can't just use
  // HGPLAIN because we have not found a way to get colored output when we do.
  const args = ['--config', 'extensions.pager=!', concise ? 'ssl' : 'smartlog'];
  const execOptions = {
    cwd: workingDirectory,
    NO_HGPLAIN: concise, // `hg ssl` is likely user-defined.
    TTY_OUTPUT: ttyOutput,
  };
  return hgAsyncExecute(args, execOptions);
}

function _commitCode(
  workingDirectory: NuclideUri,
  message: ?string,
  args: Array<string>,
): Observable<LegacyProcessMessage> {
  // TODO(T17463635)
  return Observable.fromPromise(
    (async () => {
      if (message == null) {
        return args;
      } else {
        return [...args, '-m', formatCommitMessage(message)];
      }
    })(),
  ).switchMap(argumentsWithCommitFile => {
    const execArgs = argumentsWithCommitFile;
    const execOptions: HgExecOptions = {
      cwd: workingDirectory,
    };
    return hgObserveExecution(execArgs, execOptions);
  });
}

/**
 * Commit code to version control.
 * @param message Commit message.
 * @param filePaths List of changed files to commit. If empty, all will be committed
 */
export function commit(
  workingDirectory: NuclideUri,
  message: string,
  filePaths: Array<NuclideUri> = [],
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  return _commitCode(workingDirectory, message, [
    'commit',
    ...filePaths,
  ]).publish();
}

/*
   * Edit commit message associated with a revision
   * @param revision Hash of the revision to be updated
   * @param message New commit message
   * @return Process update message while running metaedit
   */
export function editCommitMessage(
  workingDirectory: NuclideUri,
  revision: string,
  message: string,
): ConnectableObservable<LegacyProcessMessage> {
  const args = ['metaedit', '-r', revision, '-m', message];
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgObserveExecution(args, execOptions).publish();
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
export function amend(
  workingDirectory: NuclideUri,
  message: ?string,
  amendMode: AmendModeValue,
  filePaths: Array<NuclideUri> = [],
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  const args = ['amend', ...filePaths];
  switch (amendMode) {
    case 'Clean':
      args.push('--no-rebase'); // prevent auto-restack
      break;
    case 'Rebase':
      args.push('--rebase');
      break;
    case 'Fixup':
      args.push('--fixup');
      break;
    default:
      (amendMode: empty);
      throw new Error('Unexpected AmendMode');
  }
  return _commitCode(workingDirectory, message, args).publish();
}

export function restack(
  workingDirectory: NuclideUri,
): ConnectableObservable<LegacyProcessMessage> {
  const args = ['rebase', '--restack'];
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgObserveExecution(args, execOptions).publish();
}

export function revert(
  workingDirectory: NuclideUri,
  filePaths: Array<NuclideUri>,
  toRevision: ?string,
): Promise<void> {
  const args = [...filePaths];
  if (toRevision != null) {
    args.push('--rev', toRevision);
  }
  return _runSimpleInWorkingDirectory(workingDirectory, 'revert', args);
}

async function _runSimpleInWorkingDirectory(
  workingDirectory: NuclideUri,
  action: string,
  args: Array<string>,
): Promise<void> {
  const options = {
    cwd: workingDirectory,
  };
  const cmd = [action].concat(args);
  try {
    await hgAsyncExecute(cmd, options);
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
export function checkout(
  workingDirectory: NuclideUri,
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
    cwd: workingDirectory,
  };
  return hgObserveExecution(args, executionOptions).publish();
}

export function show(
  workingDirectory: NuclideUri,
  revision: number,
): ConnectableObservable<RevisionShowInfo> {
  const args = ['show', `${revision}`, '--git', '-Tjson'];
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgRunCommand(args, execOptions)
    .map(stdout => {
      return JSON.parse(stdout)[0];
    })
    .publish();
}

export function diff(
  workingDirectory: NuclideUri,
  revision: string,
  unified: ?number,
  diffCommitted: ?boolean,
  noPrefix: ?boolean,
  noDates: ?boolean,
): ConnectableObservable<string> {
  const args = ['diff', diffCommitted ? '-c' : '-r', revision];
  if (unified != null) {
    args.push('--unified', `${unified}`);
  }
  if (noPrefix) {
    args.push('--noprefix');
  }
  if (noDates) {
    args.push('--nodates');
  }
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgRunCommand(args, execOptions).publish();
}

/**
 * Removes files not tracked by Mercurial.
 */
export function purge(workingDirectory: NuclideUri): Promise<void> {
  return _runSimpleInWorkingDirectory(workingDirectory, 'purge', ['--files']);
}

/**
 * Undoes the effect of a local commit, specifically the working directory parent.
 */
export function uncommit(workingDirectory: NuclideUri): Promise<void> {
  return _runSimpleInWorkingDirectory(workingDirectory, 'uncommit', []);
}

/**
 * @param revision This could be a changeset ID, name of a bookmark, revision number, etc.
 */
export function strip(
  workingDirectory: NuclideUri,
  revision: string,
): Promise<void> {
  return _runSimpleInWorkingDirectory(workingDirectory, 'hide', [revision]);
}

/**
 * @param revision This could be a changeset ID, name of a bookmark, revision number, etc.
 * @param create Currently, this parameter is ignored.
 */
export async function checkoutForkBase(
  workingDirectory: NuclideUri,
): Promise<void> {
  const forkBaseName = await getForkBaseName(workingDirectory);
  await _runSimpleInWorkingDirectory(workingDirectory, 'checkout', [
    forkBaseName,
  ]);
}

/*
 * Silence errors from hg calls that don't include any tracked files - these
 * are generally harmless and should not create an error notification.
 * This checks the error string in order to avoid potentially slow hg pre-checks.
 */
function _rethrowErrorIfHelpful(e: Error): void {
  if (!IGNORABLE_ERROR_SUFFIXES.some(s => e.message.endsWith(s + '\n'))) {
    throw e;
  }
}

/**
 * Rename/move files versioned under Hg.
 * @param filePaths Which files should be renamed/moved.
 * @param destPath What should the file be renamed/moved to.
 */
export async function rename(
  workingDirectory: NuclideUri,
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
    await _runSimpleInWorkingDirectory(workingDirectory, 'rename', args);
  } catch (e) {
    if (after) {
      _rethrowErrorIfHelpful(e);
    } else {
      throw e;
    }
  }
}

/**
 * Remove a file versioned under Hg.
 * @param filePath Which file should be removed.
 */
export async function remove(
  workingDirectory: NuclideUri,
  filePaths: Array<NuclideUri>,
  after?: boolean,
): Promise<void> {
  const args = ['-f', ...filePaths.map(p => nuclideUri.getPath(p))];
  if (after) {
    args.unshift('--after');
  }

  try {
    await _runSimpleInWorkingDirectory(workingDirectory, 'remove', args);
  } catch (e) {
    if (after) {
      _rethrowErrorIfHelpful(e);
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
export async function forget(
  workingDirectory: NuclideUri,
  filePaths: Array<NuclideUri>,
): Promise<void> {
  const args = [...filePaths.map(p => nuclideUri.getPath(p))];
  try {
    await _runSimpleInWorkingDirectory(workingDirectory, 'forget', args);
  } catch (e) {
    throw e;
  }
}

/**
 * Version a new file under Hg.
 * @param filePath Which file should be versioned.
 */
export function add(
  workingDirectory: NuclideUri,
  filePaths: Array<NuclideUri>,
): Promise<void> {
  return _runSimpleInWorkingDirectory(workingDirectory, 'add', filePaths);
}

export async function getTemplateCommitMessage(
  workingDirectory: NuclideUri,
): Promise<?string> {
  const args = ['debugcommitmessage'];
  const execOptions = {
    cwd: workingDirectory,
  };

  try {
    const {stdout} = await hgAsyncExecute(args, execOptions);
    return stdout.replace(DEFAULT_HG_COMMIT_TITLE_REGEX, '');
  } catch (e) {
    getLogger('nuclide-hg-rpc').error(
      'Failed when trying to get template commit message',
    );
    return null;
  }
}

export async function getHeadCommitMessage(
  workingDirectory: NuclideUri,
): Promise<?string> {
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
    cwd: workingDirectory,
  };
  try {
    const output = await hgAsyncExecute(args, execOptions);
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

export async function log(
  workingDirectory: NuclideUri,
  filePaths: Array<NuclideUri>,
  limit?: ?number,
): Promise<VcsLogResponse> {
  const args = ['log', '-T', '{dict(node|short, desc, date, author)|json}\n'];
  if (limit != null && limit > 0) {
    args.push('--limit', String(limit));
  }
  for (const filePath of filePaths) {
    args.push(filePath);
  }

  const execOptions = {
    cwd: workingDirectory,
  };
  const result = await hgAsyncExecute(args, execOptions);
  const entries = result.stdout
    .split('\n')
    .filter(s => s !== '')
    .map(JSON.parse);
  return {entries};
}

export function fetchMergeConflicts(
  workingDirectory: NuclideUri,
): ConnectableObservable<?MergeConflicts> {
  const args = [
    'resolve',
    '--tool=internal:dumpjson',
    '--all',
    '--config',
    'extensions.conflictinfo=',
  ];
  const execOptions = {
    cwd: workingDirectory,
  };
  return (
    hgRunCommand(args, execOptions)
      .map(data => {
        const parsedData = JSON.parse(data)[0];
        if (parsedData.command == null) {
          return null;
        }
        const conflicts = parsedData.conflicts.map(conflict => {
          const {local, other} = conflict;
          let status;
          conflict.output.path = resolvePathForPlatform(conflict.output.path);
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

export function markConflictedFile(
  workingDirectory: NuclideUri,
  filePath: NuclideUri,
  resolved: boolean,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  // -m marks file as resolved, -u marks file as unresolved
  const fileStatus = resolved ? '-m' : '-u';
  const args = ['resolve', fileStatus, filePath];
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgObserveExecution(args, execOptions).publish();
}

export function continueOperation(
  workingDirectory: NuclideUri,
  args: Array<string>,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)

  const execOptions = {
    cwd: workingDirectory,
  };
  return hgObserveExecution(args, execOptions).publish();
}

export function abortOperation(
  workingDirectory: NuclideUri,
  commandWithOptions: Array<string>,
): ConnectableObservable<string> {
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgRunCommand(commandWithOptions, execOptions).publish();
}

export function resolveAllFiles(
  workingDirectory: NuclideUri,
): ConnectableObservable<LegacyProcessMessage> {
  const args = ['resolve', '--all'];
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgObserveExecution(args, execOptions).publish();
}

export function rebase(
  workingDirectory: NuclideUri,
  destination: string,
  source?: string,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)

  const args = ['rebase', '-d', destination];
  if (source != null) {
    args.push('-s', source);
  }
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgObserveExecution(args, execOptions).publish();
}

/**
 *  Given a list of the new order of revisions, use histedit to rearrange
 *  history to match the input. Note that you must be checked out on the
 *  stack above where any reordering takes place, and there can be no
 *  branches off of any revision in the stack except the top one.
 */
export function reorderWithinStack(
  workingDirectory: NuclideUri,
  orderedRevisions: Array<string>,
): ConnectableObservable<string> {
  const args = [
    'histedit',
    '--commands',
    '-', // read from stdin instead of a file
  ];
  const commandsJson = JSON.stringify({
    histedit: orderedRevisions.map(hash => {
      return {
        node: hash,
        action: HisteditActions.PICK,
      };
    }),
  });

  const execOptions = {
    cwd: workingDirectory,
    input: commandsJson,
  };
  return hgRunCommand(args, execOptions).publish();
}

export function pull(
  workingDirectory: NuclideUri,
  options: Array<string>,
): ConnectableObservable<LegacyProcessMessage> {
  // TODO(T17463635)
  const args = ['pull', ...options];
  const execOptions = {
    cwd: workingDirectory,
  };

  return hgObserveExecution(args, execOptions).publish();
}

/**
 * Copy files versioned under Hg.
 * @param filePaths Which files should be copied.
 * @param destPath What should the new file be named to.
 */
export async function copy(
  workingDirectory: NuclideUri,
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
    await _runSimpleInWorkingDirectory(workingDirectory, 'copy', args);
  } catch (e) {
    if (after) {
      _rethrowErrorIfHelpful(e);
    } else {
      throw e;
    }
  }
}

/**
 * Gets the current head revision hash
 */
export function getHeadId(
  workingDirectory: NuclideUri,
  useShortHash: boolean = false,
): ConnectableObservable<string> {
  const template = useShortHash ? '{node|short}' : '{node}';
  const args = ['log', '--template', template, '--limit', '1'];
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgRunCommand(args, execOptions).publish();
}

/**
 * Given a short hash or revset, returns the full 40-char hash.
 */
export async function getFullHashForRevision(
  workingDirectory: NuclideUri,
  rev: string,
): Promise<?string> {
  const args = ['log', '--template', '{node}', '--limit', '1', '-r', rev];
  const options = {
    cwd: workingDirectory,
  };
  const output = await hgAsyncExecute(args, options);
  return output.stdout ? output.stdout.trim() : null;
}

/**
 * @param from This could be a changeset ID, name of a bookmark, revision number, etc.
 * @param to This could be a changeset ID, name of a bookmark, revision number, etc.
 * @param message New message for the resulting folded commit.
 */
export function fold(
  workingDirectory: NuclideUri,
  from: string,
  to: string,
  message: string,
): ConnectableObservable<string> {
  const args = ['fold', '--exact', `${from}::${to}`, '--message', message];

  const execOptions = {
    cwd: workingDirectory,
  };

  return hgRunCommand(args, execOptions).publish();
}

/**
 * @param patch This will be the patch passed through std/in to hg import
 * @param noCommit True will leave the imported changes uncommitted
 */
export function importPatch(
  workingDirectory: NuclideUri,
  patch: string,
  noCommit: boolean = false,
): ConnectableObservable<string> {
  const args = ['import', '-'];
  if (noCommit) {
    args.push('--no-commit');
  }
  const execOptions = {
    cwd: workingDirectory,
    input: patch,
  };

  return hgRunCommand(args, execOptions).publish();
}

export function runCommand(
  workingDirectory: NuclideUri,
  args: Array<string>,
): ConnectableObservable<string> {
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgRunCommand(args, execOptions).publish();
}

export function observeExecution(
  workingDirectory: NuclideUri,
  args: Array<string>,
  options?: {useMerge3?: boolean},
): ConnectableObservable<LegacyProcessMessage> {
  const execOptions = {
    cwd: workingDirectory,
    ...options,
  };
  return hgObserveExecution(args, execOptions).publish();
}

export function addRemove(
  workingDirectory: NuclideUri,
): ConnectableObservable<string> {
  const execOptions = {
    cwd: workingDirectory,
  };
  return hgRunCommand(['addremove'], execOptions).publish();
}

// not really Hg functionality, but this was chosen to be the best current home
// for this method as it spawns processes and should live in an remote service
export function gitDiffStrings(
  oldContents: string,
  newContents: string,
): ConnectableObservable<string> {
  return gitDiffStringsImpl(oldContents, newContents).publish();
}
