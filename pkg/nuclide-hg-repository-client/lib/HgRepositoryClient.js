'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {
  AmendModeValue,
  BookmarkInfo,
  HgService,
  DiffInfo,
  LineDiff,
  RevisionInfo,
  MergeConflict,
  RevisionFileChanges,
  StatusCodeIdValue,
  StatusCodeNumberValue,
  VcsLogResponse,
} from '../../nuclide-hg-rpc/lib/HgService';
import type {ProcessMessage} from '../../commons-node/process-rpc-types';
import type {LRUCache} from 'lru-cache';

import {Emitter} from 'atom';
import RevisionsCache from './RevisionsCache';
import {
  StatusCodeIdToNumber,
  StatusCodeNumber,
} from '../../nuclide-hg-rpc/lib/hg-constants';
import {Observable} from 'rxjs';
import LRU from 'lru-cache';
import featureConfig from '../../commons-atom/featureConfig';
import {observeBufferOpen, observeBufferCloseOrRename} from '../../commons-atom/text-buffer';
import {getLogger} from '../../nuclide-logging';

const STATUS_DEBOUNCE_DELAY_MS = 300;
const REVISION_DEBOUNCE_DELAY = 300;

export type RevisionStatusDisplay = {
  name: string,
  className: ?string,
};

type HgRepositoryOptions = {
  /** The origin URL of this repository. */
  originURL: ?string,

  /** The working directory of this repository. */
  workingDirectory: atom$Directory | RemoteDirectory,

  /** The root directory that is opened in Atom, which this Repository serves. */
  projectRootDirectory: atom$Directory,
};

/**
 *
 * Section: Constants, Type Definitions
 *
 */

const DID_CHANGE_CONFLICT_STATE = 'did-change-conflict-state';

export type RevisionStatuses = Map<number, RevisionStatusDisplay>;

type RevisionStatusCache = {
  getCachedRevisionStatuses(): Map<number, RevisionStatusDisplay>,
  observeRevisionStatusesChanges(): Observable<RevisionStatuses>,
  refresh(): void,
};

function getRevisionStatusCache(
  revisionsCache: RevisionsCache,
  workingDirectoryPath: string,
): RevisionStatusCache {
  try {
    // $FlowFB
    const FbRevisionStatusCache = require('./fb/RevisionStatusCache');
    return new FbRevisionStatusCache(revisionsCache, workingDirectoryPath);
  } catch (e) {
    return {
      getCachedRevisionStatuses() { return new Map(); },
      observeRevisionStatusesChanges() { return Observable.empty(); },
      refresh() {},
    };
  }
}

/**
 *
 * Section: HgRepositoryClient
 *
 */

/**
 * HgRepositoryClient runs on the machine that Nuclide/Atom is running on.
 * It is the interface that other Atom packages will use to access Mercurial.
 * It caches data fetched from an HgService.
 * It implements the same interface as GitRepository, (https://atom.io/docs/api/latest/GitRepository)
 * in addition to providing asynchronous methods for some getters.
 */

import type {NuclideUri} from '../../commons-node/nuclideUri';
import type {RemoteDirectory} from '../../nuclide-remote-connection';

import UniversalDisposable from '../../commons-node/UniversalDisposable';
import {observableFromSubscribeFunction} from '../../commons-node/event';
import invariant from 'assert';
import {objectFromMap} from '../../commons-node/collection';

export class HgRepositoryClient {
  _path: string;
  _workingDirectory: atom$Directory | RemoteDirectory;
  _projectDirectory: atom$Directory;
  _initializationPromise: Promise<void>;
  _originURL: ?string;
  _service: HgService;
  _emitter: Emitter;
  _subscriptions: UniversalDisposable;
  _hgStatusCache: {[filePath: NuclideUri]: StatusCodeIdValue};
  _hgDiffCache: {[filePath: NuclideUri]: DiffInfo};
  _hgDiffCacheFilesUpdating: Set<NuclideUri>;
  _hgDiffCacheFilesToClear: Set<NuclideUri>;
  _revisionsCache: RevisionsCache;
  _revisionStatusCache: RevisionStatusCache;
  _revisionIdToFileChanges: LRUCache<string, RevisionFileChanges>;
  _fileContentsAtRevisionIds: LRUCache<string, Map<NuclideUri, string>>;

  _activeBookmark: ?string;
  _isInConflict: boolean;
  _isDestroyed: boolean;

  constructor(repoPath: string, hgService: HgService, options: HgRepositoryOptions) {
    this._path = repoPath;
    this._workingDirectory = options.workingDirectory;
    this._projectDirectory = options.projectRootDirectory;
    this._originURL = options.originURL;
    this._service = hgService;
    this._isInConflict = false;
    this._isDestroyed = false;
    this._revisionsCache = new RevisionsCache(hgService);
    this._revisionStatusCache = getRevisionStatusCache(
      this._revisionsCache,
      this._workingDirectory.getPath(),
    );
    this._revisionIdToFileChanges = new LRU({max: 100});
    this._fileContentsAtRevisionIds = new LRU({max: 20});

    this._emitter = new Emitter();
    this._subscriptions = new UniversalDisposable(
      this._emitter,
      this._service,
    );

    this._hgStatusCache = {};

    this._hgDiffCache = {};
    this._hgDiffCacheFilesUpdating = new Set();
    this._hgDiffCacheFilesToClear = new Set();

    const diffStatsSubscription = (featureConfig
      .observeAsStream('nuclide-hg-repository.enableDiffStats'): Observable<any>)
      .switchMap((enableDiffStats: boolean) => {
        if (!enableDiffStats) {
          // TODO(most): rewrite fetching structures avoiding side effects
          this._hgDiffCache = {};
          this._emitter.emit('did-change-statuses');
          return Observable.empty();
        }

        return observeBufferOpen().filter(buffer => {
          const filePath = buffer.getPath();
          return filePath != null && filePath.length !== 0 && this.isPathRelevant(filePath);
        })
        .flatMap(buffer => {
          const filePath = buffer.getPath();
          invariant(filePath, 'already filtered empty and non-relevant file paths');
          return observableFromSubscribeFunction(buffer.onDidSave.bind(buffer))
            .map(() => filePath)
            .startWith(filePath)
            .takeUntil(
              observeBufferCloseOrRename(buffer)
              .do(() => {
                // TODO(most): rewrite to be simpler and avoid side effects.
                // Remove the file from the diff stats cache when the buffer is closed.
                this._hgDiffCacheFilesToClear.add(filePath);
              }),
            );
        });
      }).subscribe(filePath => this._updateDiffInfo([filePath]));

    this._subscriptions.add(diffStatsSubscription);

    this._initializationPromise = this._service.waitForWatchmanSubscriptions();
    this._initializationPromise.catch(error => {
      atom.notifications.addWarning('Mercurial: failed to subscribe to watchman!');
    });
    // Get updates that tell the HgRepositoryClient when to clear its caches.
    const fileChanges = this._service.observeFilesDidChange().refCount();
    const repoStateChanges = this._service.observeHgRepoStateDidChange().refCount();
    const activeBookmarkChanges = this._service.observeActiveBookmarkDidChange().refCount();
    const allBookmarChanges = this._service.observeBookmarksDidChange().refCount();
    const conflictStateChanges = this._service.observeHgConflictStateDidChange().refCount();
    const commitChanges = this._service.observeHgCommitsDidChange().refCount();

    const statusChangesSubscription = Observable.merge(
      fileChanges,
      repoStateChanges,
    ).debounceTime(STATUS_DEBOUNCE_DELAY_MS)
    .startWith(null)
    .switchMap(() =>
      this._service.fetchStatuses()
        .refCount()
        .catch(error => {
          getLogger().error('HgService cannot fetch statuses', error);
          return Observable.empty();
        }),
    ).subscribe(statuses => {
      this._hgStatusCache = objectFromMap(statuses);
      this._emitter.emit('did-change-statuses');
    });

    const shouldRevisionsUpdate = Observable.merge(
      activeBookmarkChanges,
      allBookmarChanges,
      commitChanges,
      repoStateChanges,
    ).debounceTime(REVISION_DEBOUNCE_DELAY);

    this._subscriptions.add(
      statusChangesSubscription,
      activeBookmarkChanges.subscribe(this.fetchActiveBookmark.bind(this)),
      allBookmarChanges.subscribe(() => { this._emitter.emit('did-change-bookmarks'); }),
      conflictStateChanges.subscribe(this._conflictStateChanged.bind(this)),
      shouldRevisionsUpdate.subscribe(() => this._revisionsCache.refreshRevisions()),
    );
  }

  destroy() {
    if (this._isDestroyed) {
      return;
    }
    this._isDestroyed = true;
    this._emitter.emit('did-destroy');
    this._subscriptions.dispose();
    this._revisionIdToFileChanges.reset();
    this._fileContentsAtRevisionIds.reset();
  }

  isDestroyed(): boolean {
    return this._isDestroyed;
  }

  _conflictStateChanged(isInConflict: boolean): void {
    this._isInConflict = isInConflict;
    this._emitter.emit(DID_CHANGE_CONFLICT_STATE);
  }

  /**
   *
   * Section: Event Subscription
   *
   */

  onDidDestroy(callback: () => mixed): IDisposable {
    return this._emitter.on('did-destroy', callback);
  }

  onDidChangeStatus(
    callback: (event: {path: string, pathStatus: StatusCodeNumberValue}) => mixed,
  ): IDisposable {
    return this._emitter.on('did-change-status', callback);
  }

  observeRevisionChanges(): Observable<Array<RevisionInfo>> {
    return this._revisionsCache.observeRevisionChanges();
  }

  observeRevisionStatusesChanges(): Observable<RevisionStatuses> {
    return this._revisionStatusCache.observeRevisionStatusesChanges();
  }

  onDidChangeStatuses(callback: () => mixed): IDisposable {
    return this._emitter.on('did-change-statuses', callback);
  }

  onDidChangeConflictState(callback: () => mixed): IDisposable {
    return this._emitter.on(DID_CHANGE_CONFLICT_STATE, callback);
  }

  /**
   *
   * Section: Repository Details
   *
   */

  getType(): string {
    return 'hg';
  }

  getPath(): string {
    return this._path;
  }

  getWorkingDirectory(): string {
    return this._workingDirectory.getPath();
  }

  // @return The path of the root project folder in Atom that this
  // HgRepositoryClient provides information about.
  getProjectDirectory(): string {
    return this._projectDirectory.getPath();
  }

  // TODO This is a stub.
  isProjectAtRoot(): boolean {
    return true;
  }

  relativize(filePath: NuclideUri): string {
    return this._workingDirectory.relativize(filePath);
  }

  // TODO This is a stub.
  hasBranch(branch: string): boolean {
    return false;
  }

  /**
   * @return The current Hg bookmark.
   */
  getShortHead(filePath: NuclideUri): string {
    if (!this._activeBookmark) {
      // Kick off a fetch to get the current bookmark. This is async.
      this._getShortHeadAsync();
      return '';
    }
    return this._activeBookmark;
  }

  // TODO This is a stub.
  isSubmodule(path: NuclideUri): boolean {
    return false;
  }

  // TODO This is a stub.
  getAheadBehindCount(reference: string, path: NuclideUri): number {
    return 0;
  }

  // TODO This is a stub.
  getCachedUpstreamAheadBehindCount(path: ?NuclideUri): {ahead: number, behind: number} {
    return {
      ahead: 0,
      behind: 0,
    };
  }

  // TODO This is a stub.
  getConfigValue(key: string, path: ?string): ?string {
    return null;
  }

  getOriginURL(path: ?string): ?string {
    return this._originURL;
  }

  // TODO This is a stub.
  getUpstreamBranch(path: ?string): ?string {
    return null;
  }

  // TODO This is a stub.
  getReferences(
    path: ?NuclideUri,
  ): {heads: Array<string>, remotes: Array<string>, tags: Array<string>} {
    return {
      heads: [],
      remotes: [],
      tags: [],
    };
  }

  // TODO This is a stub.
  getReferenceTarget(reference: string, path: ?NuclideUri): ?string {
    return null;
  }

  // Added for conflict detection.
  isInConflict(): boolean {
    return this._isInConflict;
  }


  /**
   *
   * Section: Reading Status (parity with GitRepository)
   *
   */

  // TODO (jessicalin) Can we change the API to make this method return a Promise?
  // If not, might need to do a synchronous `hg status` query.
  isPathModified(filePath: ?NuclideUri): boolean {
    if (!filePath) {
      return false;
    }
    const cachedPathStatus = this._hgStatusCache[filePath];
    if (!cachedPathStatus) {
      return false;
    } else {
      return this.isStatusModified(StatusCodeIdToNumber[cachedPathStatus]);
    }
  }

  // TODO (jessicalin) Can we change the API to make this method return a Promise?
  // If not, might need to do a synchronous `hg status` query.
  isPathNew(filePath: ?NuclideUri): boolean {
    if (!filePath) {
      return false;
    }
    const cachedPathStatus = this._hgStatusCache[filePath];
    if (!cachedPathStatus) {
      return false;
    } else {
      return this.isStatusNew(StatusCodeIdToNumber[cachedPathStatus]);
    }
  }

  isPathAdded(filePath: ?NuclideUri): boolean {
    if (!filePath) {
      return false;
    }
    const cachedPathStatus = this._hgStatusCache[filePath];
    if (!cachedPathStatus) {
      return false;
    } else {
      return this.isStatusAdded(StatusCodeIdToNumber[cachedPathStatus]);
    }
  }

  isPathUntracked(filePath: ?NuclideUri): boolean {
    if (!filePath) {
      return false;
    }
    const cachedPathStatus = this._hgStatusCache[filePath];
    if (!cachedPathStatus) {
      return false;
    } else {
      return this.isStatusUntracked(StatusCodeIdToNumber[cachedPathStatus]);
    }
  }

  // TODO (jessicalin) Can we change the API to make this method return a Promise?
  // If not, this method lies a bit by using cached information.
  // TODO (jessicalin) Make this work for ignored directories.
  isPathIgnored(filePath: ?NuclideUri): boolean {
    if (!filePath) {
      return false;
    }
    // `hg status -i` does not list the repo (the .hg directory), presumably
    // because the repo does not track itself.
    // We want to represent the fact that it's not part of the tracked contents,
    // so we manually add an exception for it via the _isPathWithinHgRepo check.
    const cachedPathStatus = this._hgStatusCache[filePath];
    if (!cachedPathStatus) {
      return this._isPathWithinHgRepo(filePath);
    } else {
      return this.isStatusIgnored(StatusCodeIdToNumber[cachedPathStatus]);
    }
  }

  /**
   * Checks if the given path is within the repo directory (i.e. `.hg/`).
   */
  _isPathWithinHgRepo(filePath: NuclideUri): boolean {
    return (filePath === this.getPath()) || (filePath.indexOf(this.getPath() + '/') === 0);
  }

  /**
   * Checks whether a path is relevant to this HgRepositoryClient. A path is
   * defined as 'relevant' if it is within the project directory opened within the repo.
   */
  isPathRelevant(filePath: NuclideUri): boolean {
    return this._projectDirectory.contains(filePath) ||
           (this._projectDirectory.getPath() === filePath);
  }

  // non-used stub.
  getDirectoryStatus(directoryPath: ?string): StatusCodeNumberValue {
    return StatusCodeNumber.CLEAN;
  }

  // We don't want to do any synchronous 'hg status' calls. Just use cached values.
  getPathStatus(filePath: NuclideUri): StatusCodeNumberValue {
    return this.getCachedPathStatus(filePath);
  }

  getCachedPathStatus(filePath: ?NuclideUri): StatusCodeNumberValue {
    if (!filePath) {
      return StatusCodeNumber.CLEAN;
    }
    const cachedStatus = this._hgStatusCache[filePath];
    if (cachedStatus) {
      return StatusCodeIdToNumber[cachedStatus];
    }
    return StatusCodeNumber.CLEAN;
  }

  getAllPathStatuses(): {[filePath: NuclideUri]: StatusCodeNumberValue} {
    const pathStatuses = Object.create(null);
    for (const filePath in this._hgStatusCache) {
      pathStatuses[filePath] = StatusCodeIdToNumber[this._hgStatusCache[filePath]];
    }
    return pathStatuses;
  }

  isStatusModified(status: ?number): boolean {
    return status === StatusCodeNumber.MODIFIED;
  }

  isStatusDeleted(status: ?number): boolean {
    return (
      status === StatusCodeNumber.MISSING ||
      status === StatusCodeNumber.REMOVED
    );
  }

  isStatusNew(status: ?number): boolean {
    return (
      status === StatusCodeNumber.ADDED ||
      status === StatusCodeNumber.UNTRACKED
    );
  }

  isStatusAdded(status: ?number): boolean {
    return status === StatusCodeNumber.ADDED;
  }

  isStatusUntracked(status: ?number): boolean {
    return status === StatusCodeNumber.UNTRACKED;
  }

  isStatusIgnored(status: ?number): boolean {
    return status === StatusCodeNumber.IGNORED;
  }

  /**
   *
   * Section: Retrieving Diffs (parity with GitRepository)
   *
   */

  getDiffStats(filePath: ?NuclideUri): {added: number, deleted: number} {
    const cleanStats = {added: 0, deleted: 0};
    if (!filePath) {
      return cleanStats;
    }
    const cachedData = this._hgDiffCache[filePath];
    return cachedData ? {added: cachedData.added, deleted: cachedData.deleted} :
        cleanStats;
  }

  /**
   * Returns an array of LineDiff that describes the diffs between the given
   * file's `HEAD` contents and its current contents.
   * NOTE: this method currently ignores the passed-in text, and instead diffs
   * against the currently saved contents of the file.
   */
  // TODO (jessicalin) Export the LineDiff type (from hg-output-helpers) when
  // types can be exported.
  // TODO (jessicalin) Make this method work with the passed-in `text`. t6391579
  getLineDiffs(filePath: ?NuclideUri, text: ?string): Array<LineDiff> {
    if (!filePath) {
      return [];
    }
    const diffInfo = this._hgDiffCache[filePath];
    return diffInfo ? diffInfo.lineDiffs : [];
  }


  /**
   *
   * Section: Retrieving Diffs (async methods)
   *
   */

  /**
   * Updates the diff information for the given paths, and updates the cache.
   * @param An array of absolute file paths for which to update the diff info.
   * @return A map of each path to its DiffInfo.
   *   This method may return `null` if the call to `hg diff` fails.
   *   A file path will not appear in the returned Map if it is not in the repo,
   *   if it has no changes, or if there is a pending `hg diff` call for it already.
   */
  async _updateDiffInfo(filePaths: Array<NuclideUri>): Promise<?Map<NuclideUri, DiffInfo>> {
    const pathsToFetch = filePaths.filter(aPath => {
      // Don't try to fetch information for this path if it's not in the repo.
      if (!this.isPathRelevant(aPath)) {
        return false;
      }
      // Don't do another update for this path if we are in the middle of running an update.
      if (this._hgDiffCacheFilesUpdating.has(aPath)) {
        return false;
      } else {
        this._hgDiffCacheFilesUpdating.add(aPath);
        return true;
      }
    });

    if (pathsToFetch.length === 0) {
      return new Map();
    }

    // Call the HgService and update our cache with the results.
    const pathsToDiffInfo = await this._service.fetchDiffInfo(pathsToFetch);
    if (pathsToDiffInfo) {
      for (const [filePath, diffInfo] of pathsToDiffInfo) {
        this._hgDiffCache[filePath] = diffInfo;
      }
    }

    // Remove files marked for deletion.
    this._hgDiffCacheFilesToClear.forEach(fileToClear => {
      delete this._hgDiffCache[fileToClear];
    });
    this._hgDiffCacheFilesToClear.clear();

    // The fetched files can now be updated again.
    for (const pathToFetch of pathsToFetch) {
      this._hgDiffCacheFilesUpdating.delete(pathToFetch);
    }

    // TODO (t9113913) Ideally, we could send more targeted events that better
    // describe what change has occurred. Right now, GitRepository dictates either
    // 'did-change-status' or 'did-change-statuses'.
    this._emitter.emit('did-change-statuses');
    return pathsToDiffInfo;
  }

  /**
  *
  * Section: Retrieving Bookmark (async methods)
  *
  */

  /*
   * @deprecated Use {#async.getShortHead} instead
   */
  fetchActiveBookmark(): Promise<string> {
    return this._getShortHeadAsync();
  }

  fetchMergeConflicts(): Promise<Array<MergeConflict>> {
    return this._service.fetchMergeConflicts();
  }

  resolveConflictedFile(filePath: NuclideUri): Promise<void> {
    return this._service.resolveConflictedFile(filePath);
  }

  /**
   *
   * Section: Checking Out
   *
   */

   /**
    * That extends the `GitRepository` implementation which takes a single file path.
    * Here, it's possible to pass an array of file paths to revert/checkout-head.
    */
  checkoutHead(filePathsArg: NuclideUri | Array<NuclideUri>): Promise<void> {
    const filePaths = Array.isArray(filePathsArg) ? filePathsArg : [filePathsArg];
    return this._service.revert(filePaths);
  }

  checkoutReference(reference: string, create: boolean): Promise<void> {
    return this._service.checkout(reference, create);
  }

  checkoutForkBase(): Promise<void> {
    return this._service.checkoutForkBase();
  }

  /**
   *
   * Section: Bookmarks
   *
   */
  createBookmark(name: string, revision: ?string): Promise<void> {
    return this._service.createBookmark(name, revision);
  }

  deleteBookmark(name: string): Promise<void> {
    return this._service.deleteBookmark(name);
  }

  renameBookmark(name: string, nextName: string): Promise<void> {
    return this._service.renameBookmark(name, nextName);
  }

  getBookmarks(): Promise<Array<BookmarkInfo>> {
    return this._service.fetchBookmarks();
  }

  onDidChangeBookmarks(callback: () => mixed): IDisposable {
    return this._emitter.on('did-change-bookmarks', callback);
  }

  async _getShortHeadAsync(): Promise<string> {
    let newlyFetchedBookmark = '';
    try {
      newlyFetchedBookmark = await this._service.fetchActiveBookmark();
    } catch (e) {
      // Suppress the error. There are legitimate times when there may be no
      // current bookmark, such as during a rebase. In this case, we just want
      // to return an empty string if there is no current bookmark.
    }
    if (newlyFetchedBookmark !== this._activeBookmark) {
      this._activeBookmark = newlyFetchedBookmark;
      // The Atom status-bar uses this as a signal to refresh the 'shortHead'.
      // There is currently no dedicated 'shortHeadDidChange' event.
      this._emitter.emit('did-change-statuses');
      this._emitter.emit('did-change-short-head');
    }
    return this._activeBookmark || '';
  }

  onDidChangeShortHead(callback: () => mixed): IDisposable {
    return this._emitter.on('did-change-short-head', callback);
  }

  /**
   *
   * Section: HgService subscriptions
   *
   */


  /**
   *
   * Section: Repository State at Specific Revisions
   *
   */
  fetchFileContentAtRevision(filePath: NuclideUri, revision: string): Observable<string> {
    let fileContentsAtRevision = this._fileContentsAtRevisionIds.get(revision);
    if (fileContentsAtRevision == null) {
      fileContentsAtRevision = new Map();
      this._fileContentsAtRevisionIds.set(revision, fileContentsAtRevision);
    }
    const committedContents = fileContentsAtRevision.get(filePath);
    if (committedContents != null) {
      return Observable.of(committedContents);
    } else {
      return this._service.fetchFileContentAtRevision(filePath, revision)
        .refCount()
        .do(contents => fileContentsAtRevision.set(filePath, contents));
    }
  }

  fetchFilesChangedAtRevision(revision: string): Observable<RevisionFileChanges> {
    const changes = this._revisionIdToFileChanges.get(revision);
    if (changes != null) {
      return Observable.of(changes);
    } else {
      return this._service.fetchFilesChangedAtRevision(revision)
        .refCount()
        .do(fetchedChanges => this._revisionIdToFileChanges.set(revision, fetchedChanges));
    }
  }

  fetchRevisionInfoBetweenHeadAndBase(): Promise<Array<RevisionInfo>> {
    return this._service.fetchRevisionInfoBetweenHeadAndBase();
  }

  fetchSmartlogRevisions(): Observable<Array<RevisionInfo>> {
    return this._service.fetchSmartlogRevisions().refCount();
  }

  refreshRevisions(): void {
    this._revisionsCache.refreshRevisions();
  }

  refreshRevisionsStatuses(): void {
    this._revisionStatusCache.refresh();
  }

  getCachedRevisions(): Array<RevisionInfo> {
    return this._revisionsCache.getCachedRevisions();
  }

  getCachedRevisionStatuses(): RevisionStatuses {
    return this._revisionStatusCache.getCachedRevisionStatuses();
  }

  // See HgService.getBaseRevision.
  getBaseRevision(): Promise<RevisionInfo> {
    return this._service.getBaseRevision();
  }

  // See HgService.getBlameAtHead.
  getBlameAtHead(filePath: NuclideUri): Promise<Map<string, string>> {
    return this._service.getBlameAtHead(filePath);
  }

  getTemplateCommitMessage(): Promise<?string> {
    // TODO(t12228275) This is a stopgap hack, fix it.
    return this._service.getTemplateCommitMessage();
  }

  getHeadCommitMessage(): Promise<?string> {
    return this._service.getHeadCommitMessage();
  }

  /**
   * Return relative paths to status code number values object.
   * matching `GitRepositoryAsync` implementation.
   */
  getCachedPathStatuses(): {[filePath: string]: StatusCodeNumberValue} {
    const absoluteCodePaths = this.getAllPathStatuses();
    const relativeCodePaths = {};
    for (const absolutePath in absoluteCodePaths) {
      const relativePath = this.relativize(absolutePath);
      relativeCodePaths[relativePath] = absoluteCodePaths[absolutePath];
    }
    return relativeCodePaths;
  }


  getConfigValueAsync(key: string, path: ?string): Promise<?string> {
    return this._service.getConfigValueAsync(key);
  }

  // See HgService.getDifferentialRevisionForChangeSetId.
  getDifferentialRevisionForChangeSetId(changeSetId: string): Promise<?string> {
    return this._service.getDifferentialRevisionForChangeSetId(changeSetId);
  }

  getSmartlog(ttyOutput: boolean, concise: boolean): Promise<Object> {
    return this._service.getSmartlog(ttyOutput, concise);
  }

  copy(filePaths: Array<string>, destPath: string, after: boolean = false): Promise<void> {
    return this._service.copy(filePaths, destPath, after);
  }

  rename(filePaths: Array<string>, destPath: string, after: boolean = false): Promise<void> {
    return this._service.rename(filePaths, destPath, after);
  }

  remove(filePaths: Array<string>, after: boolean = false): Promise<void> {
    return this._service.remove(filePaths, after);
  }

  addAll(filePaths: Array<NuclideUri>): Promise<void> {
    return this._service.add(filePaths);
  }

  commit(message: string): Observable<ProcessMessage> {
    return this._service.commit(message)
      .refCount()
      .finally(this._clearClientCache.bind(this));
  }

  amend(message: ?string, amendMode: AmendModeValue): Observable<ProcessMessage> {
    return this._service.amend(message, amendMode)
      .refCount()
      .finally(this._clearClientCache.bind(this));
  }

  revert(filePaths: Array<NuclideUri>, toRevision?: ?string): Promise<void> {
    return this._service.revert(filePaths, toRevision);
  }

  log(filePaths: Array<NuclideUri>, limit?: ?number): Promise<VcsLogResponse> {
    // TODO(mbolin): Return an Observable so that results appear faster.
    // Unfortunately, `hg log -Tjson` is not Observable-friendly because it will
    // not parse as JSON until all of the data has been printed to stdout.
    return this._service.log(filePaths, limit);
  }

  continueRebase(): Promise<void> {
    return this._service.continueRebase();
  }

  abortRebase(): Promise<void> {
    return this._service.abortRebase();
  }

  rebase(destination: string, source?: string): Observable<ProcessMessage> {
    return this._service.rebase(destination, source).refCount();
  }

  pull(options?: Array<string> = []): Observable<ProcessMessage> {
    return this._service.pull(options).refCount();
  }

  _clearClientCache(): void {
    this._hgDiffCache = {};
    this._hgStatusCache = {};
    this._emitter.emit('did-change-statuses');
  }
}
