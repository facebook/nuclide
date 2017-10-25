/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import {SFTPWrapper} from 'ssh2';
import {Observable} from 'rxjs';
import * as pathModule from 'path';
import * as fs from 'fs';
import {Deferred} from 'nuclide-commons/promise';

import type {
  FileEntry as _FileEntryType,
  InputAttributes,
  ReadFileOptions,
  ReadFlags,
  WriteFileOptions,
  Stats,
  TransferOptions,
} from 'ssh2';
export type {
  AppendFlags,
  InputAttributes,
  ReadFileOptions,
  ReadFlags,
  WriteFileOptions,
  WriteFlags,
  Stats,
  TransferOptions,
} from 'ssh2';

/** `readFile` returns either a string, if an encoding was specified, or else Buffer */
type ReadFileFunction = ((
  path: string,
  options: string | ReadFileOptions,
) => Promise<string>) &
  ((
    path: string,
    options?: {encoding?: null, flag: ReadFlags},
  ) => Promise<Buffer>);

/**
 * This is essentially FileEntry from ssh2, but provides `Stats` instead of just `Attributes`.
 * (I.e. adds helper functions to query the stats.)
 */
export class FileEntry {
  filename: string;
  longname: string;
  stats: Stats;
  constructor(entry: _FileEntryType) {
    this.filename = entry.filename;
    this.longname = entry.longname;
    this.stats = {
      ...entry.attrs,
      _checkModeProperty(property) {
        // eslint-disable-next-line no-bitwise
        return (this.mode & fs.constants.S_IFMT) === property;
      },
      isDirectory() {
        return this._checkModeProperty(fs.constants.S_IFDIR);
      },
      isFile() {
        return this._checkModeProperty(fs.constants.S_IFREG);
      },
      isBlockDevice() {
        return this._checkModeProperty(fs.constants.S_IFBLK);
      },
      isCharacterDevice() {
        return this._checkModeProperty(fs.constants.S_IFCHR);
      },
      isSymbolicLink() {
        return this._checkModeProperty(fs.constants.S_IFLNK);
      },
      isFIFO() {
        return this._checkModeProperty(fs.constants.S_IFIFO);
      },
      isSocket() {
        return this._checkModeProperty(fs.constants.S_IFSOCK);
      },
    };
  }
}

/**
 * Represents an SFTP connection. This wraps the `SFTPWrapper` class from ssh2, but reinterprets the
 * API using promises instead of callbacks. The methods of this class generally correspond to the
 * same methods on `SFTPWrapper`. Instances of this class should typically be obtained from
 * `SshClient`.
 */
export class SftpClient {
  _sftp: SFTPWrapper;
  _onError: Observable<any>;
  _onEnd: Observable<void>;
  _onClose: Observable<void>;
  _onContinue: Observable<void>;
  _deferredContinue: ?Deferred<void> = null;
  _endPromise: Deferred<void>;
  _closePromise: Deferred<void>;

  /**
   * Wraps and takes ownership of the `SFTPWrapper`.
   */
  constructor(sftp: SFTPWrapper) {
    this._sftp = sftp;
    this._onError = Observable.fromEvent(this._sftp, 'error');
    this._onEnd = Observable.fromEvent(this._sftp, 'end');
    this._onClose = Observable.fromEvent(this._sftp, 'close');
    this._onContinue = Observable.fromEvent(this._sftp, 'continue');
    this._closePromise = new Deferred();
    this._endPromise = new Deferred();

    this._sftp.on('end', this._endPromise.resolve);
    this._sftp.on('continue', () => this._resolveContinue());
    this._sftp.on('close', () => {
      this._resolveContinue();
      this._endPromise.resolve();
      this._closePromise.resolve();
    });
  }

  /**
   * @return `true` if the channel is ready for more data; `false` if the caller should wait for
   * the 'continue' event before sending more data. This variable is updated immediately after each
   * asynchronous call (i.e. when a Promise is returned; before it is necessarily resolved).
   */
  get continue(): boolean {
    return this._deferredContinue == null;
  }

  /** Emitted when an error occurred. */
  onError(): Observable<any> {
    return this._onError;
  }

  /** Emitted when the session has ended. */
  onEnd(): Observable<void> {
    return this._onEnd;
  }

  /** Emitted when the session has closed. */
  onClose(): Observable<void> {
    return this._onClose;
  }

  /** Emitted when more requests/data can be sent to the stream. */
  onContinue(): Observable<void> {
    return this._onContinue;
  }

  /**
   * Downloads a file at `remotePath` to `localPath` using parallel reads for faster throughput.
   */
  fastGet(
    remotePath: string,
    localPath: string,
    options: TransferOptions = {},
  ): Promise<void> {
    return this._sftpToPromise(
      this._sftp.fastGet,
      remotePath,
      localPath,
      options,
    );
  }

  /**
   * Uploads a file from `localPath` to `remotePath` using parallel reads for faster throughput.
   */
  fastPut(
    localPath: string,
    remotePath: string,
    options: TransferOptions = {},
  ): Promise<void> {
    return this._sftpToPromise(
      this._sftp.fastPut,
      localPath,
      remotePath,
      options,
    );
  }

  /**
   * Reads a file
   * @param options either the encoding (string) or a bag of options
   */
  +readFile: ReadFileFunction = function(path: string, ...args: any) {
    return this._sftpToPromise(this._sftp.readFile, path, ...args);
  };

  /**
   * Writes to a file
   * @param options either the encoding (string) or a bag of options
   */
  writeFile(
    path: string,
    data: string | Buffer,
    options?: string | WriteFileOptions = {
      encoding: 'utf8',
      mode: 0o666,
      flag: 'w',
    },
  ): Promise<void> {
    return this._sftpToPromise(this._sftp.writeFile, path, data, options);
  }

  /**
   * Retrieves attributes for `path`.
   *
   * Updates 'continue'.
   */
  stat(path: string): Promise<Stats> {
    return this._sftpToPromiseContinue(this._sftp.stat, path);
  }

  /**
   * Retrieves attributes for `path`. If `path` is a symlink, the link itself is stat'ed
   * instead of the resource it refers to.
   *
   * Updates 'continue'.
   */
  lstat(path: string): Promise<Stats> {
    return this._sftpToPromiseContinue(this._sftp.lstat, path);
  }

  /**
   * Returns `true` iff `path` is an existing file or directory.
   *
   * Updates 'continue'.
   */
  async exists(path: string): Promise<boolean> {
    // Note: SFTPWrapper and ssh2-streams include an `exists` method, which also uses `stat`.
    // We reimplement it here so we can properly handle the `continue` event.
    try {
      await this.stat(path);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Retrieves a directory listing.
   *
   * Updates 'continue'.
   */
  readdir(location: string | Buffer): Promise<Array<FileEntry>> {
    return this._sftpToPromiseContinue(
      this._sftp.readdir,
      location,
    ).then((files: Array<_FileEntryType>) =>
      files.map(entry => new FileEntry(entry)),
    );
  }

  /**
   * Removes the directory at `path`.
   *
   * Updates `continue`.
   */
  rmdir(path: string): Promise<void> {
    return this._sftpToPromiseContinue(this._sftp.rmdir, path);
  }

  /**
   * Removes the file/symlink at `path`.
   *
   * Updates `continue`.
   */
  unlink(path: string): Promise<void> {
    return this._sftpToPromiseContinue(this._sftp.unlink, path);
  }

  /**
   * Updates `continue`.
   */
  async filetree(
    path: string,
  ): Promise<Array<{filename: string, stats: Stats}>> {
    const stats = await this.lstat(path);
    const results = [{filename: path, stats}];
    if (stats.isDirectory()) {
      results.push(...(await this._dirtree(path)));
    }
    return results;
  }

  async _dirtree(
    path: string,
  ): Promise<Array<{filename: string, stats: Stats}>> {
    const files = await this.readdir(path);
    const results: Array<{filename: string, stats: Stats}> = [];
    await Promise.all(
      files.map(async file => {
        const filename = pathModule.join(path, file.filename);
        results.push({filename, stats: file.stats});
        if (file.stats.isDirectory()) {
          results.push(...(await this._dirtree(filename)));
        }
      }),
    );
    return results;
  }

  /**
   * Deletes an entire directory tree or file. If this operation fails, a subset of files may
   * have been deleted.
   * Updates `continue`.
   * @param path the directory to remove
   * @param ignoreErrors silently return if an error is encountered.
   * @return `true` if successful; `false` if `ignoreErrors==true` and unsuccessful
   */
  async rmtree(path: string, ignoreErrors: boolean = false): Promise<boolean> {
    try {
      const stat = await this.lstat(path);
      if (stat.isDirectory()) {
        await this._rmtree(path);
      } else {
        await this.unlink(path);
      }
      return true;
    } catch (error) {
      if (ignoreErrors) {
        return false;
      } else {
        throw error;
      }
    }
  }

  async _rmtree(path: string): Promise<void> {
    const files = await this.readdir(path);
    await Promise.all(
      files.map(async file => {
        const filename = pathModule.join(path, file.filename);
        if (file.stats.isDirectory()) {
          await this._rmtree(filename);
        } else {
          await this.unlink(filename);
        }
      }),
    );

    await this.rmdir(path);
  }

  /**
   * Creates a new directory `path`.
   *
   * Updates 'continue'.
   * @param createIntermediateDirectories Same as the -p option to Posix mkdir. Creates any
   *    intermediate directories as required.
   */
  async mkdir(
    path: string,
    attributes: InputAttributes & {
      createIntermediateDirectories?: boolean,
    } = {},
  ): Promise<void> {
    if (attributes.createIntermediateDirectories) {
      return this._mkdirCreateIntermediate(path, attributes);
    } else {
      return this._sftpToPromiseContinue(this._sftp.mkdir, path, attributes);
    }
  }

  async _mkdirCreateIntermediate(
    path: string,
    attributes: InputAttributes = {},
  ): Promise<void> {
    if (await this.exists(path)) {
      return;
    }
    const parent = pathModule.dirname(path);
    await this._mkdirCreateIntermediate(parent, attributes);
    return this._sftpToPromiseContinue(this._sftp.mkdir, path, attributes);
  }

  /**
   * Ends the stream.
   */
  async end(): Promise<void> {
    await this._readyForData();
    this._sftp.end();
    return this._endPromise.promise;
  }

  _resolveContinue() {
    if (this._deferredContinue != null) {
      const {resolve} = this._deferredContinue;
      this._deferredContinue = null;
      resolve();
    }
  }

  async _readyForData() {
    while (this._deferredContinue != null) {
      // eslint-disable-next-line no-await-in-loop
      await this._deferredContinue.promise;
    }
  }

  async _sftpToPromiseContinue(func: Function, ...args: any): Promise<any> {
    await this._readyForData();
    return new Promise((resolve, reject) => {
      args.push((err, result) => {
        if (err != null) {
          return reject(err);
        }
        resolve(result);
      });

      const readyForData = func.apply(this._sftp, args);
      if (!readyForData && this._deferredContinue == null) {
        this._deferredContinue = new Deferred();
      }
    });
  }

  async _sftpToPromise(func: any, ...args: any): Promise<any> {
    await this._readyForData();
    return new Promise((resolve, reject) => {
      args.push((err, result) => {
        if (err != null) {
          return reject(err);
        }
        resolve(result);
      });
      func.apply(this._sftp, args);
    });
  }
}
