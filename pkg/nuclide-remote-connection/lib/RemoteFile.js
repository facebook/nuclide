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

import type {ServerConnection} from './ServerConnection';
import type {RemoteDirectory} from './RemoteDirectory';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import typeof * as FileSystemService from '../../nuclide-server/lib/services/FileSystemService';

import invariant from 'assert';
import passesGK from '../../commons-node/passesGK';
import nuclideUri from 'nuclide-commons/nuclideUri';
import crypto from 'crypto';
import {Disposable, Emitter} from 'atom';
import {getLogger} from 'log4js';
import Stream from 'stream';

const logger = getLogger('nuclide-remote-connection');

/* Mostly implements https://atom.io/docs/api/latest/File */
export class RemoteFile {
  _deleted: boolean;
  _emitter: Emitter;
  _encoding: ?string;
  _localPath: string;
  _path: NuclideUri;
  _realpath: ?string;
  _server: ServerConnection;
  _subscriptionCount: number;
  _watchSubscription: ?rxjs$ISubscription;
  _digest: ?string;
  _symlink: boolean;

  constructor(
    server: ServerConnection,
    remotePath: NuclideUri,
    symlink: boolean = false,
  ) {
    this._server = server;
    this.setPath(remotePath);
    this._emitter = new Emitter();
    this._subscriptionCount = 0;
    this._deleted = false;
    this._symlink = symlink;
  }

  dispose() {
    this._subscriptionCount = 0;
    this._unsubscribeFromNativeChangeEvents();
  }

  onDidChange(callback: () => mixed): IDisposable {
    this._willAddSubscription();
    return this._trackUnsubscription(this._emitter.on('did-change', callback));
  }

  onDidRename(callback: () => mixed): IDisposable {
    // TODO: this is not supported by the Watchman API.
    return new Disposable();
  }

  onDidDelete(callback: () => mixed): IDisposable {
    this._willAddSubscription();
    return this._trackUnsubscription(this._emitter.on('did-delete', callback));
  }

  _willAddSubscription(): void {
    this._subscriptionCount++;
    this._subscribeToNativeChangeEvents();
  }

  _subscribeToNativeChangeEvents(): void {
    if (this._watchSubscription) {
      return;
    }

    const watchStream = this._server.getFileWatch(this._path);
    this._watchSubscription = watchStream.subscribe(
      watchUpdate => {
        // This only happens after a `setPath` and subsequent file rename.
        // Getting this message signifies that the new file should be ready for watching.
        if (watchUpdate.path !== this._path) {
          logger.debug('watchFile renamed:', this._path);
          this._unsubscribeFromNativeChangeEvents();
          this._subscribeToNativeChangeEvents();
          return;
        }
        logger.debug('watchFile update:', watchUpdate);
        switch (watchUpdate.type) {
          case 'change':
            return this._handleNativeChangeEvent();
          case 'delete':
            return this._handleNativeDeleteEvent();
        }
      },
      error => {
        // In the case of new files, it's normal for the remote file to not exist yet.
        if (error.code !== 'ENOENT') {
          logger.error('Failed to subscribe RemoteFile:', this._path, error);
        }
        this._watchSubscription = null;
      },
      () => {
        // Nothing needs to be done if the root directory watch has ended.
        logger.debug(`watchFile ended: ${this._path}`);
        this._watchSubscription = null;
      },
    );

    // No need to wait for that async check.
    this._checkWatchOutOfOpenDirectories();
  }

  async _checkWatchOutOfOpenDirectories(): Promise<void> {
    const isPathInOpenDirectories = atom.project.contains(this._path);
    if (
      !isPathInOpenDirectories &&
      (await passesGK('nuclide_watch_warn_unmanaged_file'))
    ) {
      atom.notifications.addWarning(
        `Couldn't watch remote file \`${nuclideUri.basename(
          this._path,
        )}\` for changes!`,
        {
          detail:
            "Updates to the file outside Nuclide won't reload automatically\n" +
            "Please add the file's project directory to Nuclide\n",
          dismissable: true,
        },
      );
    }
  }

  _handleNativeChangeEvent(): Promise<void> {
    // Don't bother checking the file - this can be very expensive.
    this._emitter.emit('did-change');
    return Promise.resolve();
  }

  _handleNativeDeleteEvent(): void {
    this._unsubscribeFromNativeChangeEvents();
    if (!this._deleted) {
      this._deleted = true;
      this._emitter.emit('did-delete');
    }
  }

  /*
   * Return a new Disposable that upon dispose, will remove the bound watch subscription.
   * When the number of subscriptions reach 0, the file is unwatched.
   */
  _trackUnsubscription(subscription: IDisposable): IDisposable {
    return new Disposable(() => {
      subscription.dispose();
      this._didRemoveSubscription();
    });
  }

  _didRemoveSubscription(): void {
    this._subscriptionCount--;
    if (this._subscriptionCount === 0) {
      this._unsubscribeFromNativeChangeEvents();
    }
  }

  _unsubscribeFromNativeChangeEvents(): void {
    if (this._watchSubscription) {
      this._watchSubscription.unsubscribe();
      this._watchSubscription = null;
    }
  }

  onWillThrowWatchError(
    callback: (watchError: {error: Error, handle: () => void}) => mixed,
  ): IDisposable {
    return this._emitter.on('will-throw-watch-error', callback);
  }

  isFile(): boolean {
    return true;
  }

  isDirectory(): boolean {
    return false;
  }

  exists(): Promise<boolean> {
    return this._getFileSystemService().exists(this._path);
  }

  existsSync(): boolean {
    return true;
  }

  getDigestSync(): string {
    // flowlint-next-line sketchy-null-string:off
    if (!this._digest) {
      // File's `getDigestSync()` calls `readSync()`, which we don't implement.
      // However, we mimic it's behavior for when a file does not exist.
      this._setDigest('');
    }
    // flowlint-next-line sketchy-null-string:off
    invariant(this._digest);
    return this._digest;
  }

  async getDigest(): Promise<string> {
    // flowlint-next-line sketchy-null-string:off
    if (this._digest) {
      return this._digest;
    }
    await this.read();
    // flowlint-next-line sketchy-null-string:off
    invariant(this._digest);
    return this._digest;
  }

  _setDigest(contents: string) {
    const hash = crypto.createHash('sha1').update(contents || '');
    invariant(hash);
    this._digest = hash.digest('hex');
  }

  setEncoding(encoding: string) {
    this._encoding = encoding;
  }

  getEncoding(): ?string {
    return this._encoding;
  }

  setPath(remotePath: NuclideUri): void {
    const {path: localPath} = nuclideUri.parse(remotePath);
    this._localPath = localPath;
    this._path = remotePath;
  }

  getPath(): string {
    return this._path;
  }

  getLocalPath(): string {
    return this._localPath;
  }

  getRealPathSync(): string {
    // flowlint-next-line sketchy-null-string:off
    return this._realpath || this._path;
  }

  async getRealPath(): Promise<string> {
    if (this._realpath == null) {
      this._realpath = await this._getFileSystemService().realpath(this._path);
    }
    invariant(this._realpath);
    return this._realpath;
  }

  getBaseName(): string {
    return nuclideUri.basename(this._path);
  }

  async create(): Promise<boolean> {
    const wasCreated = await this._getFileSystemService().newFile(this._path);
    if (this._subscriptionCount > 0) {
      this._subscribeToNativeChangeEvents();
    }
    return wasCreated;
  }

  async delete(): Promise<any> {
    try {
      await this._getFileSystemService().unlink(this._path);
      this._handleNativeDeleteEvent();
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  async copy(newPath: NuclideUri): Promise<boolean> {
    const wasCopied = await this._getFileSystemService().copy(
      this._path,
      newPath,
    );
    this._subscribeToNativeChangeEvents();
    return wasCopied;
  }

  async read(flushCache?: boolean): Promise<string> {
    const data = await this._getFileSystemService().readFile(this._path);
    const contents = data.toString();
    this._setDigest(contents);
    // TODO: respect encoding
    return contents;
  }

  readSync(flushcache: boolean): Promise<string> {
    throw new Error('readSync is not supported in RemoteFile');
  }

  async write(text: string): Promise<void> {
    const previouslyExisted = await this.exists();
    await this._getFileSystemService().writeFile(this._path, text);
    if (!previouslyExisted && this._subscriptionCount > 0) {
      this._subscribeToNativeChangeEvents();
    }
  }

  async writeWithPermission(text: string, permission: number): Promise<void> {
    const previouslyExisted = await this.exists();
    await this._getFileSystemService().writeFile(this._path, text, {
      mode: permission,
    });
    if (!previouslyExisted && this._subscriptionCount > 0) {
      this._subscribeToNativeChangeEvents();
    }
  }

  getParent(): RemoteDirectory {
    const directoryPath = nuclideUri.dirname(this._path);
    const remoteConnection = this._server.getRemoteConnectionForUri(this._path);
    const hgRepositoryDescription =
      remoteConnection != null
        ? remoteConnection.getHgRepositoryDescription()
        : null;
    return this._server.createDirectory(directoryPath, hgRepositoryDescription);
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

  /**
   * Implementing a real stream (with chunks) is potentially very inefficient, as making
   * multiple RPC calls can take much longer than just fetching the entire file.
   * This stream just fetches the entire file contents for now.
   */
  createReadStream(): stream$Readable {
    const path = this._path;
    const service = this._getFileSystemService();
    // push() triggers another read(), so make sure we don't read the file twice.
    let pushed = false;
    const stream = new Stream.Readable({
      read(size) {
        if (pushed) {
          return;
        }
        service.readFile(path).then(
          buffer => {
            pushed = true;
            stream.push(buffer);
            stream.push(null);
          },
          err => {
            stream.emit('error', err);
          },
        );
      },
    });
    return stream;
  }

  /**
   * As with createReadStream, it's potentially very inefficient to write remotely in multiple
   * chunks. This stream just accumulates the data locally and flushes it all at once.
   */
  createWriteStream(): stream$Writable {
    const writeData = [];
    let writeLength = 0;
    const stream = new Stream.Writable({
      write(chunk, encoding, next) {
        // `chunk` may be mutated by the caller, so make sure it's copied.
        writeData.push(Buffer.from(chunk));
        writeLength += chunk.length;
        next();
      },
    });
    const originalEnd = stream.end;
    // TODO: (hansonw) T20364274 Override final() in Node 8 and above.
    // For now, we'll overwrite the end function manually.
    // $FlowIgnore
    stream.end = cb => {
      invariant(cb instanceof Function, 'end() called without a callback');
      this._getFileSystemService()
        .writeFileBuffer(this._path, Buffer.concat(writeData, writeLength))
        .then(
          () => cb(),
          err => {
            stream.emit('error', err);
            cb();
          },
        );
      originalEnd.call(stream);
    };
    return stream;
  }
}
