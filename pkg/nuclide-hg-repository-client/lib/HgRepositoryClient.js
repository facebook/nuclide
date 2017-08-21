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
  AmendModeValue,
  BookmarkInfo,
  CheckoutOptions,
  HgService,
  DiffInfo,
  LineDiff,
  RevisionInfo,
  RevisionShowInfo,
  MergeConflicts,
  RevisionFileChanges,
  StatusCodeNumberValue,
  StatusCodeIdValue,
  VcsLogResponse,
} from '../../nuclide-hg-rpc/lib/HgService';
import type {LegacyProcessMessage} from 'nuclide-commons/process';
import type {LRUCache} from 'lru-cache';
import type {ConnectableObservable} from 'rxjs';

import {parseHgDiffUnifiedOutput} from '../../nuclide-hg-rpc/lib/hg-diff-output-parser';
import {Emitter} from 'atom';
import {cacheWhileSubscribed} from 'nuclide-commons/observable';
import RevisionsCache from './RevisionsCache';
import {gitDiffContentAgainstFile} from './utils';
import {
  StatusCodeIdToNumber,
  StatusCodeNumber,
} from '../../nuclide-hg-rpc/lib/hg-constants';
import {BehaviorSubject, Observable} from 'rxjs';
import LRU from 'lru-cache';
import featureConfig from 'nuclide-commons-atom/feature-config';
import observePaneItemVisibility from 'nuclide-commons-atom/observePaneItemVisibility';
import {isValidTextEditor} from 'nuclide-commons-atom/text-editor';
import {observeBufferCloseOrRename} from '../../commons-atom/text-buffer';
import {getLogger} from 'log4js';

const STATUS_DEBOUNCE_DELAY_MS = 300;
const REVISION_DEBOUNCE_DELAY = 300;
const BOOKMARKS_DEBOUNCE_DELAY = 200;
const FETCH_BOOKMARKS_TIMEOUT = 15 * 1000;

export type RevisionStatusDisplay = {
  id: number,
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
    const FbRevisionStatusCache = require('./fb/RevisionStatusCache').default;
    return new FbRevisionStatusCache(revisionsCache, workingDirectoryPath);
  } catch (e) {
    return {
      getCachedRevisionStatuses() {
        return new Map();
      },
      observeRevisionStatusesChanges() {
        return Observable.empty();
      },
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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {RemoteDirectory} from '../../nuclide-remote-connection';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {mapTransform} from 'nuclide-commons/collection';

export type HgStatusChanges = {
  statusChanges: Observable<Map<NuclideUri, StatusCodeNumberValue>>,
  isCalculatingChanges: Observable<boolean>,
};

export class HgRepositoryClient {
  _path: string;
  _workingDirectory: atom$Directory | RemoteDirectory;
  _projectDirectory: atom$Directory;
  _initializationPromise: Promise<void>;
  _originURL: ?string;
  _service: HgService;
  _emitter: Emitter;
  _subscriptions: UniversalDisposable;
  _hgStatusCache: Map<NuclideUri, StatusCodeNumberValue>; // legacy, only for uncommitted
  _hgUncommittedStatusChanges: HgStatusChanges;
  _hgHeadStatusChanges: HgStatusChanges;
  _hgStackStatusChanges: HgStatusChanges;
  _hgDiffCache: Map<NuclideUri, DiffInfo>;
  _hgDiffCacheFilesUpdating: Set<NuclideUri>;
  _hgDiffCacheFilesToClear: Set<NuclideUri>;
  _revisionsCache: RevisionsCache;
  _revisionStatusCache: RevisionStatusCache;
  _revisionIdToFileChanges: LRUCache<string, RevisionFileChanges>;
  _fileContentsAtRevisionIds: LRUCache<string, Map<NuclideUri, string>>;
  _fileContentsAtHead: LRUCache<NuclideUri, string>;
  _currentHeadId: ?string;

  _bookmarks: BehaviorSubject<{
    isLoading: boolean,
    bookmarks: Array<BookmarkInfo>,
  }>;
  _isInConflict: boolean;
  _isDestroyed: boolean;

  constructor(
    repoPath: string,
    hgService: HgService,
    options: HgRepositoryOptions,
  ) {
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
    this._fileContentsAtHead = new LRU({max: 30});

    this._emitter = new Emitter();
    this._subscriptions = new UniversalDisposable(this._emitter, this._service);

    this._hgStatusCache = new Map();
    this._bookmarks = new BehaviorSubject({isLoading: true, bookmarks: []});

    this._hgDiffCache = new Map();
    this._hgDiffCacheFilesUpdating = new Set();
    this._hgDiffCacheFilesToClear = new Set();

    const diffStatsSubscription = (featureConfig.observeAsStream(
      'nuclide-hg-repository.enableDiffStats',
    ): Observable<any>)
      .switchMap((enableDiffStats: boolean) => {
        if (!enableDiffStats) {
          // TODO(most): rewrite fetching structures avoiding side effects
          this._hgDiffCache = new Map();
          this._emitter.emit('did-change-statuses');
          return Observable.empty();
        }

        return observableFromSubscribeFunction(
          atom.workspace.observePaneItems.bind(atom.workspace),
        ).flatMap(paneItem => {
          const item = ((paneItem: any): Object);
          return this._observePaneItemVisibility(item).switchMap(visible => {
            if (!visible || !isValidTextEditor(item)) {
              return Observable.empty();
            }

            const textEditor = (item: atom$TextEditor);
            const buffer = textEditor.getBuffer();
            const filePath = buffer.getPath();
            if (
              filePath == null ||
              filePath.length === 0 ||
              !this.isPathRelevant(filePath)
            ) {
              return Observable.empty();
            }
            return Observable.combineLatest(
              observableFromSubscribeFunction(
                buffer.onDidSave.bind(buffer),
              ).startWith(''),
              this._hgUncommittedStatusChanges.statusChanges,
            )
              .filter(([_, statusChanges]) => {
                return (
                  statusChanges.has(filePath) &&
                  this.isStatusModified(statusChanges.get(filePath))
                );
              })
              .map(() => filePath)
              .takeUntil(
                Observable.merge(
                  observeBufferCloseOrRename(buffer),
                  this._observePaneItemVisibility(item).filter(v => !v),
                ).do(() => {
                  // TODO(most): rewrite to be simpler and avoid side effects.
                  // Remove the file from the diff stats cache when the buffer is closed.
                  this._hgDiffCacheFilesToClear.add(filePath);
                }),
              );
          });
        });
      })
      .flatMap(filePath => this._updateDiffInfo([filePath]))
      .subscribe();
    this._subscriptions.add(diffStatsSubscription);

    this._initializationPromise = this._service.waitForWatchmanSubscriptions();
    this._initializationPromise.catch(error => {
      atom.notifications.addWarning(
        'Mercurial: failed to subscribe to watchman!',
      );
    });
    // Get updates that tell the HgRepositoryClient when to clear its caches.
    const fileChanges = this._service.observeFilesDidChange().refCount();
    const repoStateChanges = this._service
      .observeHgRepoStateDidChange()
      .refCount();
    const activeBookmarkChanges = this._service
      .observeActiveBookmarkDidChange()
      .refCount();
    const allBookmarkChanges = this._service
      .observeBookmarksDidChange()
      .refCount();
    const conflictStateChanges = this._service
      .observeHgConflictStateDidChange()
      .refCount();
    const commitChanges = this._service.observeHgCommitsDidChange().refCount();

    this._hgUncommittedStatusChanges = this._observeStatus(
      fileChanges,
      repoStateChanges,
      () => this._service.fetchStatuses(),
    );

    this._hgStackStatusChanges = this._observeStatus(
      fileChanges,
      repoStateChanges,
      () => this._service.fetchStackStatuses(),
    );

    this._hgHeadStatusChanges = this._observeStatus(
      fileChanges,
      repoStateChanges,
      () => this._service.fetchHeadStatuses(),
    );

    const statusChangesSubscription = this._hgUncommittedStatusChanges.statusChanges.subscribe(
      statuses => {
        this._hgStatusCache = statuses;
        this._emitter.emit('did-change-statuses');
      },
    );

    const shouldRevisionsUpdate = Observable.merge(
      this._bookmarks.asObservable(),
      commitChanges,
      repoStateChanges,
    ).debounceTime(REVISION_DEBOUNCE_DELAY);

    const bookmarksUpdates = Observable.merge(
      activeBookmarkChanges,
      allBookmarkChanges,
    )
      .startWith(null)
      .debounceTime(BOOKMARKS_DEBOUNCE_DELAY)
      .switchMap(() =>
        Observable.defer(() => {
          return this._service
            .fetchBookmarks()
            .refCount()
            .timeout(FETCH_BOOKMARKS_TIMEOUT);
        })
          .retry(2)
          .catch(error => {
            getLogger('nuclide-hg-repository-client').error(
              'failed to fetch bookmarks info:',
              error,
            );
            return Observable.empty();
          }),
      );

    this._subscriptions.add(
      statusChangesSubscription,
      bookmarksUpdates.subscribe(bookmarks =>
        this._bookmarks.next({isLoading: false, bookmarks}),
      ),
      conflictStateChanges.subscribe(this._conflictStateChanged.bind(this)),
      shouldRevisionsUpdate.subscribe(() => {
        this._revisionsCache.refreshRevisions();
        this._fileContentsAtHead.reset();
        this._hgDiffCache = new Map();
      }),
    );
  }

  _observeStatus(
    fileChanges: Observable<Array<string>>,
    repoStateChanges: Observable<void>,
    fetchStatuses: () => ConnectableObservable<
      Map<NuclideUri, StatusCodeIdValue>,
    >,
  ): HgStatusChanges {
    const triggers = Observable.merge(fileChanges, repoStateChanges)
      .debounceTime(STATUS_DEBOUNCE_DELAY_MS)
      .share()
      .startWith(null);
    // Share comes before startWith. That's because fileChanges/repoStateChanges
    // are already hot and can be shared fine. But we want both our subscribers,
    // statusChanges and isCalculatingChanges, to pick up their own copy of
    // startWith(null) no matter which order they subscribe.

    const statusChanges = cacheWhileSubscribed(
      triggers
        .switchMap(() =>
          fetchStatuses().refCount().catch(error => {
            getLogger('nuclide-hg-repository-client').error(
              'HgService cannot fetch statuses',
              error,
            );
            return Observable.empty();
          }),
        )
        .map(uriToStatusIds =>
          mapTransform(uriToStatusIds, (v, k) => StatusCodeIdToNumber[v]),
        ),
    );

    const isCalculatingChanges = cacheWhileSubscribed(
      Observable.merge(
        triggers.map(_ => true),
        statusChanges.map(_ => false),
      ).distinctUntilChanged(),
    );

    return {statusChanges, isCalculatingChanges};
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
    callback: (event: {
      path: string,
      pathStatus: StatusCodeNumberValue,
    }) => mixed,
  ): IDisposable {
    return this._emitter.on('did-change-status', callback);
  }

  observeBookmarks(): Observable<Array<BookmarkInfo>> {
    return this._bookmarks
      .asObservable()
      .filter(b => !b.isLoading)
      .map(b => b.bookmarks);
  }

  observeRevisionChanges(): Observable<Array<RevisionInfo>> {
    return this._revisionsCache.observeRevisionChanges();
  }

  observeRevisionStatusesChanges(): Observable<RevisionStatuses> {
    return this._revisionStatusCache.observeRevisionStatusesChanges();
  }

  observeUncommittedStatusChanges(): HgStatusChanges {
    return this._hgUncommittedStatusChanges;
  }

  observeHeadStatusChanges(): HgStatusChanges {
    return this._hgHeadStatusChanges;
  }

  observeStackStatusChanges(): HgStatusChanges {
    return this._hgStackStatusChanges;
  }

  _observePaneItemVisibility(item: Object): Observable<boolean> {
    return observePaneItemVisibility(item);
  }

  onDidChangeStatuses(callback: () => mixed): IDisposable {
    return this._emitter.on('did-change-statuses', callback);
  }

  onDidChangeConflictState(callback: () => mixed): IDisposable {
    return this._emitter.on(DID_CHANGE_CONFLICT_STATE, callback);
  }

  onDidChangeInteractiveMode(callback: boolean => mixed): IDisposable {
    return this._emitter.on('did-change-interactive-mode', callback);
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
  getShortHead(filePath?: NuclideUri): string {
    return (
      this._bookmarks
        .getValue()
        .bookmarks.filter(bookmark => bookmark.active)
        .map(bookmark => bookmark.bookmark)[0] || ''
    );
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
  getCachedUpstreamAheadBehindCount(
    path: ?NuclideUri,
  ): {ahead: number, behind: number} {
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
    // flowlint-next-line sketchy-null-string:off
    if (!filePath) {
      return false;
    }
    const cachedPathStatus = this._hgStatusCache.get(filePath);
    if (!cachedPathStatus) {
      return false;
    } else {
      return this.isStatusModified(cachedPathStatus);
    }
  }

  // TODO (jessicalin) Can we change the API to make this method return a Promise?
  // If not, might need to do a synchronous `hg status` query.
  isPathNew(filePath: ?NuclideUri): boolean {
    // flowlint-next-line sketchy-null-string:off
    if (!filePath) {
      return false;
    }
    const cachedPathStatus = this._hgStatusCache.get(filePath);
    if (!cachedPathStatus) {
      return false;
    } else {
      return this.isStatusNew(cachedPathStatus);
    }
  }

  isPathAdded(filePath: ?NuclideUri): boolean {
    // flowlint-next-line sketchy-null-string:off
    if (!filePath) {
      return false;
    }
    const cachedPathStatus = this._hgStatusCache.get(filePath);
    if (!cachedPathStatus) {
      return false;
    } else {
      return this.isStatusAdded(cachedPathStatus);
    }
  }

  isPathUntracked(filePath: ?NuclideUri): boolean {
    // flowlint-next-line sketchy-null-string:off
    if (!filePath) {
      return false;
    }
    const cachedPathStatus = this._hgStatusCache.get(filePath);
    if (!cachedPathStatus) {
      return false;
    } else {
      return this.isStatusUntracked(cachedPathStatus);
    }
  }

  // TODO (jessicalin) Can we change the API to make this method return a Promise?
  // If not, this method lies a bit by using cached information.
  // TODO (jessicalin) Make this work for ignored directories.
  isPathIgnored(filePath: ?NuclideUri): boolean {
    // flowlint-next-line sketchy-null-string:off
    if (!filePath) {
      return false;
    }
    // `hg status -i` does not list the repo (the .hg directory), presumably
    // because the repo does not track itself.
    // We want to represent the fact that it's not part of the tracked contents,
    // so we manually add an exception for it via the _isPathWithinHgRepo check.
    const cachedPathStatus = this._hgStatusCache.get(filePath);
    if (!cachedPathStatus) {
      return this._isPathWithinHgRepo(filePath);
    } else {
      return this.isStatusIgnored(cachedPathStatus);
    }
  }

  /**
   * Checks if the given path is within the repo directory (i.e. `.hg/`).
   */
  _isPathWithinHgRepo(filePath: NuclideUri): boolean {
    return (
      filePath === this.getPath() ||
      filePath.indexOf(this.getPath() + '/') === 0
    );
  }

  /**
   * Checks whether a path is relevant to this HgRepositoryClient. A path is
   * defined as 'relevant' if it is within the project directory opened within the repo.
   */
  isPathRelevant(filePath: NuclideUri): boolean {
    return (
      this._projectDirectory.contains(filePath) ||
      this._projectDirectory.getPath() === filePath
    );
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
    // flowlint-next-line sketchy-null-string:off
    if (!filePath) {
      return StatusCodeNumber.CLEAN;
    }
    const cachedStatus = this._hgStatusCache.get(filePath);
    if (cachedStatus) {
      return cachedStatus;
    }
    return StatusCodeNumber.CLEAN;
  }

  // getAllPathStatuses -- this legacy API gets only uncommitted statuses
  getAllPathStatuses(): {[filePath: NuclideUri]: StatusCodeNumberValue} {
    const pathStatuses = Object.create(null);
    for (const [filePath, status] of this._hgStatusCache) {
      pathStatuses[filePath] = status;
    }
    return pathStatuses;
  }

  isStatusModified(status: ?number): boolean {
    return status === StatusCodeNumber.MODIFIED;
  }

  isStatusDeleted(status: ?number): boolean {
    return (
      status === StatusCodeNumber.MISSING || status === StatusCodeNumber.REMOVED
    );
  }

  isStatusNew(status: ?number): boolean {
    return (
      status === StatusCodeNumber.ADDED || status === StatusCodeNumber.UNTRACKED
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
    // flowlint-next-line sketchy-null-string:off
    if (!filePath) {
      return cleanStats;
    }
    const cachedData = this._hgDiffCache.get(filePath);
    return cachedData
      ? {added: cachedData.added, deleted: cachedData.deleted}
      : cleanStats;
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
    // flowlint-next-line sketchy-null-string:off
    if (!filePath) {
      return [];
    }
    const diffInfo = this._hgDiffCache.get(filePath);
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
  _updateDiffInfo(
    filePaths: Array<NuclideUri>,
  ): Observable<?Map<NuclideUri, DiffInfo>> {
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
      return Observable.of(new Map());
    }

    return this._getCurrentHeadId().switchMap(currentHeadId => {
      if (currentHeadId == null) {
        return Observable.of(new Map());
      }

      return this._getFileDiffs(
        pathsToFetch,
        currentHeadId,
      ).do(pathsToDiffInfo => {
        if (pathsToDiffInfo) {
          for (const [filePath, diffInfo] of pathsToDiffInfo) {
            this._hgDiffCache.set(filePath, diffInfo);
          }
        }

        // Remove files marked for deletion.
        this._hgDiffCacheFilesToClear.forEach(fileToClear => {
          this._hgDiffCache.delete(fileToClear);
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
      });
    });
  }

  _getFileDiffs(
    pathsToFetch: Array<NuclideUri>,
    revision: string,
  ): Observable<Map<NuclideUri, DiffInfo>> {
    const fileContents = pathsToFetch.map(filePath => {
      const cachedContent = this._fileContentsAtHead.get(filePath);
      let contentObservable;
      if (cachedContent == null) {
        contentObservable = this._service
          .fetchFileContentAtRevision(filePath, revision)
          .refCount()
          .map(contents => {
            this._fileContentsAtHead.set(filePath, contents);
            return contents;
          });
      } else {
        contentObservable = Observable.of(cachedContent);
      }
      return contentObservable
        .switchMap(content => {
          return gitDiffContentAgainstFile(content, filePath);
        })
        .map(diff => ({
          filePath,
          diff,
        }));
    });
    const diffs = Observable.merge(...fileContents)
      .map(({filePath, diff}) => {
        // This is to differentiate between diff delimiter and the source
        // eslint-disable-next-line no-useless-escape
        const toParse = diff.split('--- ');
        const lineDiff = parseHgDiffUnifiedOutput(toParse[1]);
        return [filePath, lineDiff];
      })
      .toArray()
      .map(contents => new Map(contents));
    return diffs;
  }

  _getCurrentHeadId(): Observable<string> {
    if (this._currentHeadId != null) {
      return Observable.of(this._currentHeadId);
    }
    return this._service
      .getHeadId()
      .refCount()
      .do(headId => (this._currentHeadId = headId));
  }

  _updateInteractiveMode(isInteractiveMode: boolean) {
    this._emitter.emit('did-change-interactive-mode', isInteractiveMode);
  }

  fetchMergeConflicts(): Observable<?MergeConflicts> {
    return this._service.fetchMergeConflicts().refCount();
  }

  markConflictedFile(
    filePath: NuclideUri,
    resolved: boolean,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this._service.markConflictedFile(filePath, resolved).refCount();
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
    const filePaths = Array.isArray(filePathsArg)
      ? filePathsArg
      : [filePathsArg];
    return this._service.revert(filePaths);
  }

  checkoutReference(
    reference: string,
    create: boolean,
    options?: CheckoutOptions,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this._service.checkout(reference, create, options).refCount();
  }

  show(revision: number): Observable<RevisionShowInfo> {
    return this._service.show(revision).refCount();
  }

  purge(): Promise<void> {
    return this._service.purge();
  }

  stripReference(reference: string): Promise<void> {
    return this._service.strip(reference);
  }

  uncommit(): Promise<void> {
    return this._service.uncommit();
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

  getBookmarks(): Array<BookmarkInfo> {
    return this._bookmarks.getValue().bookmarks;
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
  fetchFileContentAtRevision(
    filePath: NuclideUri,
    revision: string,
  ): Observable<string> {
    let fileContentsAtRevision = this._fileContentsAtRevisionIds.get(revision);
    if (fileContentsAtRevision == null) {
      fileContentsAtRevision = new Map();
      this._fileContentsAtRevisionIds.set(revision, fileContentsAtRevision);
    }
    const committedContents = fileContentsAtRevision.get(filePath);
    if (committedContents != null) {
      return Observable.of(committedContents);
    } else {
      return this._service
        .fetchFileContentAtRevision(filePath, revision)
        .refCount()
        .do(contents => fileContentsAtRevision.set(filePath, contents));
    }
  }

  fetchFilesChangedAtRevision(
    revision: string,
  ): Observable<RevisionFileChanges> {
    const changes = this._revisionIdToFileChanges.get(revision);
    if (changes != null) {
      return Observable.of(changes);
    } else {
      return this._service
        .fetchFilesChangedAtRevision(revision)
        .refCount()
        .do(fetchedChanges =>
          this._revisionIdToFileChanges.set(revision, fetchedChanges),
        );
    }
  }

  fetchFilesChangedSinceRevision(
    revision: string,
  ): Observable<Map<NuclideUri, StatusCodeNumberValue>> {
    return this._service
      .fetchStatuses(revision)
      .refCount()
      .map(fileStatuses => {
        const statusesWithCodeIds = new Map();
        for (const [filePath, code] of fileStatuses) {
          statusesWithCodeIds.set(filePath, StatusCodeIdToNumber[code]);
        }
        return statusesWithCodeIds;
      });
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
  getBlameAtHead(filePath: NuclideUri): Promise<Array<?RevisionInfo>> {
    return this._service.getBlameAtHead(filePath);
  }

  getTemplateCommitMessage(): Promise<?string> {
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

  copy(
    filePaths: Array<NuclideUri>,
    destPath: NuclideUri,
    after: boolean = false,
  ): Promise<void> {
    return this._service.copy(filePaths, destPath, after);
  }

  rename(
    filePaths: Array<NuclideUri>,
    destPath: NuclideUri,
    after: boolean = false,
  ): Promise<void> {
    return this._service.rename(filePaths, destPath, after);
  }

  remove(filePaths: Array<NuclideUri>, after: boolean = false): Promise<void> {
    return this._service.remove(filePaths, after);
  }

  forget(filePaths: Array<NuclideUri>): Promise<void> {
    return this._service.forget(filePaths);
  }

  addAll(filePaths: Array<NuclideUri>): Promise<void> {
    return this._service.add(filePaths);
  }

  commit(
    message: string,
    filePaths: Array<NuclideUri> = [],
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this._service
      .commit(message, filePaths)
      .refCount()
      .do(processMessage =>
        this._clearOnSuccessExit(processMessage, filePaths),
      );
  }

  amend(
    message: ?string,
    amendMode: AmendModeValue,
    filePaths: Array<NuclideUri> = [],
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this._service
      .amend(message, amendMode, filePaths)
      .refCount()
      .do(processMessage =>
        this._clearOnSuccessExit(processMessage, filePaths),
      );
  }

  restack(): Observable<LegacyProcessMessage> {
    return this._service.restack().refCount();
  }

  editCommitMessage(
    revision: string,
    message: string,
  ): Observable<LegacyProcessMessage> {
    return this._service.editCommitMessage(revision, message).refCount();
  }

  splitRevision(): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    this._updateInteractiveMode(true);
    return this._service
      .splitRevision()
      .refCount()
      .finally(this._updateInteractiveMode.bind(this, false));
  }

  _clearOnSuccessExit(
    message: LegacyProcessMessage,
    filePaths: Array<NuclideUri>,
  ) {
    if (message.kind === 'exit' && message.exitCode === 0) {
      this._clearClientCache(filePaths);
    }
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

  continueOperation(command: string): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this._service.continueOperation(command).refCount();
  }

  abortOperation(command: string): Observable<string> {
    return this._service.abortOperation(command).refCount();
  }

  resolveAllFiles(): Observable<LegacyProcessMessage> {
    return this._service.resolveAllFiles().refCount();
  }

  rebase(
    destination: string,
    source?: string,
  ): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this._service.rebase(destination, source).refCount();
  }

  pull(options?: Array<string> = []): Observable<LegacyProcessMessage> {
    // TODO(T17463635)
    return this._service.pull(options).refCount();
  }

  _clearClientCache(filePaths: Array<NuclideUri>): void {
    if (filePaths.length === 0) {
      this._hgDiffCache = new Map();
      this._hgStatusCache = new Map();
      this._fileContentsAtHead.reset();
    } else {
      this._hgDiffCache = new Map(this._hgDiffCache);
      this._hgStatusCache = new Map(this._hgStatusCache);
      filePaths.forEach(filePath => {
        this._hgDiffCache.delete(filePath);
        this._hgStatusCache.delete(filePath);
      });
    }
    this._emitter.emit('did-change-statuses');
  }
}
