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

import typeof * as FileSystemService from '../../nuclide-server/lib/services/FileSystemService';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import type {ServerConnection} from './ServerConnection';
import type {HgRepositoryDescription} from '../../nuclide-source-control-helpers/lib/types';
import type {RemoteFile} from './RemoteFile';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Emitter} from 'event-kit';
import {getLogger} from 'log4js';
import {trackTimingSampled} from 'nuclide-analytics';
import {memoize} from 'lodash';

const logger = getLogger('nuclide-remote-connection');

const MARKER_PROPERTY_FOR_REMOTE_DIRECTORY = '__nuclide_remote_directory__';
export const EDEN_PERFORMANCE_SAMPLE_RATE = 10;

/**
 * This is a global function because RemoteDirectory's are not re-used. Cached
 * results must be global since they cannot be attached to an instance.
 */
const _isEden = memoize(
  async (
    uri: NuclideUri,
    fileSystemService: FileSystemService,
  ): Promise<boolean | string> => {
    if (nuclideUri.endsWithEdenDir(uri)) {
      // this is needed to avoid checking for .eden/.eden/root, which results in
      // ELOOP: too many symbolic links encountered
      return true;
    }
    const edenDir = nuclideUri.join(uri, '.eden/root');
    try {
      const isEden = await fileSystemService.exists(edenDir);
      return isEden;
    } catch (e) {
      logger.error(
        'Failed to determine if',
        uri,
        'is part of eden because "exists" call failed on',
        edenDir,
      );
      logger.error(e);
      return e ? e.code : '';
    }
  },
);

/* Mostly implements https://atom.io/docs/api/latest/Directory */
export class RemoteDirectory {
  static isRemoteDirectory(
    directory: atom$Directory | RemoteDirectory,
  ): boolean {
    /* $FlowFixMe */
    return directory[MARKER_PROPERTY_FOR_REMOTE_DIRECTORY] === true;
  }

  _watchSubscription: ?rxjs$ISubscription;
  _server: ServerConnection;
  _uri: NuclideUri;
  _emitter: atom$Emitter;
  _subscriptionCount: number;
  _host: string;
  _localPath: string;
  _hgRepositoryDescription: ?HgRepositoryDescription;
  _symlink: boolean;
  _deleted: boolean;
  _isArchive: boolean;
  /**
   * @param uri should be of the form "nuclide://example.com/path/to/directory".
   */
  constructor(
    server: ServerConnection,
    uri: string,
    symlink: boolean = false,
    options: ?any,
  ) {
    Object.defineProperty(this, MARKER_PROPERTY_FOR_REMOTE_DIRECTORY, {
      value: true,
    });
    this._server = server;
    this._uri = uri;
    this._emitter = new Emitter();
    this._subscriptionCount = 0;
    this._symlink = symlink;
    const {path: directoryPath, hostname} = nuclideUri.parse(uri);
    invariant(hostname != null);
    /** In the example, this would be "nuclide://example.com". */
    this._host = hostname;
    /** In the example, this would be "/path/to/directory". */
    this._localPath = directoryPath;
    // A workaround before Atom 2.0: see ::getHgRepoInfo of main.js.
    this._hgRepositoryDescription = options
      ? options.hgRepositoryDescription
      : null;
    this._isArchive = options != null && Boolean(options.isArchive);
    this._deleted = false;
  }

  dispose() {
    this._subscriptionCount = 0;
    this._unsubscribeFromNativeChangeEvents();
  }

  onDidChange(callback: () => any): IDisposable {
    this._willAddSubscription();
    return this._trackUnsubscription(this._emitter.on('did-change', callback));
  }

  onDidDelete(callback: () => any): IDisposable {
    this._willAddSubscription();
    return this._trackUnsubscription(this._emitter.on('did-delete', callback));
  }

  /**
   * We may want to provide an implementation for this at some point.
   * However, for the time being, we don't get any benefits from doing so.
   */
  onDidChangeFiles(callback: () => mixed): IDisposable {
    return new UniversalDisposable();
  }

  _willAddSubscription(): void {
    this._subscriptionCount++;
    try {
      this._subscribeToNativeChangeEvents();
    } catch (err) {
      logger.error(
        'Failed to subscribe RemoteDirectory:',
        this._localPath,
        err,
      );
    }
  }

  _subscribeToNativeChangeEvents(): void {
    if (this._watchSubscription) {
      return;
    }
    const watchStream = nuclideUri.isInArchive(this._uri)
      ? this._server.getFileWatch(nuclideUri.ancestorOutsideArchive(this._uri))
      : this._server.getDirectoryWatch(this._uri);
    this._watchSubscription = watchStream.subscribe(
      watchUpdate => {
        logger.debug('watchDirectory update:', watchUpdate);
        switch (watchUpdate.type) {
          case 'change':
            return this._handleNativeChangeEvent();
          case 'delete':
            return this._handleNativeDeleteEvent();
        }
      },
      error => {
        logger.error('Failed to subscribe RemoteDirectory:', this._uri, error);
        this._watchSubscription = null;
      },
      () => {
        // Nothing needs to be done if the root directory watch has ended.
        logger.debug(`watchDirectory ended: ${this._uri}`);
        this._watchSubscription = null;
      },
    );
  }

  _handleNativeChangeEvent(): void {
    this._emitter.emit('did-change');
  }

  _handleNativeDeleteEvent(): void {
    this._unsubscribeFromNativeChangeEvents();
    if (!this._deleted) {
      this._deleted = true;
      this._emitter.emit('did-delete');
    }
  }

  _trackUnsubscription(subscription: IDisposable): IDisposable {
    return new UniversalDisposable(() => {
      subscription.dispose();
      this._didRemoveSubscription();
    });
  }

  _didRemoveSubscription(): void {
    this._subscriptionCount--;
    if (this._subscriptionCount === 0) {
      return this._unsubscribeFromNativeChangeEvents();
    }
  }

  _unsubscribeFromNativeChangeEvents(): void {
    if (this._watchSubscription) {
      try {
        this._watchSubscription.unsubscribe();
      } catch (error) {
        logger.warn(
          'RemoteDirectory failed to unsubscribe from native events:',
          this._uri,
          error.message,
        );
      }
      this._watchSubscription = null;
    }
  }

  _joinLocalPath(name: string): string {
    return this._isArchive
      ? nuclideUri.archiveJoin(this._localPath, name)
      : nuclideUri.join(this._localPath, name);
  }

  isFile(): boolean {
    return false;
  }

  isDirectory(): boolean {
    return true;
  }

  isRoot(): boolean {
    return this._isRoot(this._localPath);
  }

  exists(): Promise<boolean> {
    return this._getFileSystemService().exists(this._uri);
  }

  existsSync(): boolean {
    // As of Atom 1.12, `atom.project.addPath` checks for project existence.
    // We must return true to have our remote directories be addable.
    return true;
  }

  _isRoot(filePath_: string): boolean {
    let filePath = filePath_;
    filePath = nuclideUri.normalize(filePath);
    const parts = nuclideUri.parsePath(filePath);
    return parts.root === filePath;
  }

  getPath(): string {
    return this._uri;
  }

  getLocalPath(): string {
    return this._localPath;
  }

  getRealPathSync(): string {
    // Remote paths should already be resolved.
    return this._uri;
  }

  getBaseName(): string {
    return nuclideUri.basename(this._localPath);
  }

  relativize(uri: string): string {
    if (!nuclideUri.isRemote(uri || '')) {
      return uri;
    }
    const parsedUrl = nuclideUri.parse(uri);
    if (parsedUrl.hostname !== this._host) {
      return uri;
    }
    return nuclideUri.relative(this._localPath, parsedUrl.path);
  }

  getParent(): RemoteDirectory {
    if (this.isRoot()) {
      return this;
    } else {
      const uri = nuclideUri.createRemoteUri(
        this._host,
        nuclideUri.dirname(this._localPath),
      );
      return this._server.createDirectory(uri, this._hgRepositoryDescription);
    }
  }

  getFile(filename: string): RemoteFile {
    const uri = nuclideUri.createRemoteUri(
      this._host,
      this._joinLocalPath(filename),
    );
    return this._server.createFile(uri);
  }

  getSubdirectory(dir: string): RemoteDirectory {
    const uri = nuclideUri.createRemoteUri(
      this._host,
      this._joinLocalPath(dir),
    );
    return this._server.createDirectory(uri, this._hgRepositoryDescription);
  }

  async create(): Promise<boolean> {
    invariant(!this._deleted, 'RemoteDirectory has been deleted');
    const created = await this._getFileSystemService().mkdirp(this._uri);
    if (this._subscriptionCount > 0) {
      this._subscribeToNativeChangeEvents();
    }
    return created;
  }

  async delete(): Promise<any> {
    await this._getFileSystemService().rmdir(this._uri);
    this._handleNativeDeleteEvent();
  }

  getEntriesSync(): Array<RemoteFile | RemoteDirectory> {
    throw new Error('not implemented');
  }

  /*
   * Calls `callback` with either an Array of entries or an Error if there was a problem fetching
   * those entries.
   *
   * Note: Although this function is `async`, it never rejects. Check whether the `error` argument
   * passed to `callback` is `null` to determine if there was an error.
   */
  async getEntries(
    callback: (
      error: ?atom$GetEntriesError,
      // $FlowFixMe(>=0.72.0) Flow suppress (T29189893)
      entries: ?Array<RemoteDirectory | RemoteFile>,
    ) => any,
  ): Promise<void> {
    let entries = [];
    const readDirError = await trackTimingSampled(
      'eden-filesystem-metrics:readdirSorted',
      async () => {
        try {
          entries = await this._getFileSystemService().readdirSorted(this._uri);
          return false;
        } catch (e) {
          callback(e, null);
          return true;
        }
      },
      EDEN_PERFORMANCE_SAMPLE_RATE,
      {
        isEden: await _isEden(this._uri, this._getFileSystemService()),
        uri: this._uri,
      },
    );
    if (readDirError) {
      return;
    }

    const directories: Array<RemoteDirectory> = [];
    const files = [];
    entries.forEach(entry => {
      const [name, isFile, isSymlink] = entry;
      const uri = nuclideUri.createRemoteUri(
        this._host,
        this._joinLocalPath(name),
      );
      if (isFile) {
        files.push(this._server.createFile(uri, isSymlink));
      } else {
        directories.push(
          this._server.createDirectory(
            uri,
            this._hgRepositoryDescription,
            isSymlink,
          ),
        );
      }
    });
    callback(null, directories.concat(files));
  }

  contains(pathToCheck: ?string): boolean {
    if (!nuclideUri.isRemote(pathToCheck || '')) {
      return false;
    }

    return nuclideUri.contains(this.getPath(), pathToCheck || '');
  }

  off() {
    // This method is part of the EmitterMixin used by Atom's local Directory, but not documented
    // as part of the API - https://atom.io/docs/api/latest/Directory,
    // However, it appears to be called in project.coffee by Atom.
  }

  // A workaround before Atom 2.0: see ::getHgRepoInfo of main.js.
  getHgRepositoryDescription(): ?HgRepositoryDescription {
    return this._hgRepositoryDescription;
  }

  isSymbolicLink(): boolean {
    return this._symlink;
  }

  _getFileSystemService(): FileSystemService {
    return this._getService('FileSystemService');
  }

  _getService(serviceName: string): any {
    return this._server.getService(serviceName);
  }
}
