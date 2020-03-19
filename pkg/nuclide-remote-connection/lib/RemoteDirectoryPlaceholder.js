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

import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import Stream from 'stream';

/**
 * A Directory object that returns the bare minimum that's required by Atom.
 * It always exists, to satisfy Atom's existence checks.
 * Should be removed ASAP once the remote connection is restored.
 */
export default class RemoteDirectoryPlaceholder {
  symlink = false;

  _uri: string;
  _hostname: ?string;
  _path: string;

  constructor(uri: string) {
    this._uri = uri;
    const {hostname, path} = nuclideUri.parse(uri);
    this._hostname = hostname;
    this._path = path;
  }

  create(mode?: number): Promise<boolean> {
    return Promise.resolve(true);
  }

  onDidChange(callback: () => mixed): IDisposable {
    return new UniversalDisposable();
  }

  onDidChangeFiles(callback: () => mixed): IDisposable {
    return new UniversalDisposable();
  }

  isFile(): boolean {
    return false;
  }

  isDirectory(): boolean {
    return true;
  }

  isRoot(): boolean {
    return this._path === '/';
  }

  exists(): Promise<boolean> {
    return Promise.resolve(true);
  }

  existsSync(): boolean {
    return true;
  }

  getPath(): string {
    return this._uri;
  }

  getBaseName(): string {
    return nuclideUri.basename(this._uri);
  }

  relativize(uri: string): string {
    if (!uri) {
      return uri;
    }
    const parsedUrl = nuclideUri.parse(uri);
    if (parsedUrl.hostname !== this._hostname) {
      return uri;
    }
    return nuclideUri.relative(this._path, parsedUrl.path);
  }

  onDidRename(callback: () => void): IDisposable {
    return new UniversalDisposable();
  }

  onDidDelete(callback: () => void): IDisposable {
    return new UniversalDisposable();
  }

  getParent(): RemoteDirectoryPlaceholder {
    return new RemoteDirectoryPlaceholder(nuclideUri.dirname(this._uri));
  }

  getFile(filename: string): RemoteFilePlaceholder {
    return new RemoteFilePlaceholder(nuclideUri.join(this._uri, filename));
  }

  getSubdirectory(dirname: string): RemoteDirectoryPlaceholder {
    return new RemoteDirectoryPlaceholder(nuclideUri.join(this._uri, dirname));
  }

  getEntries(
    callback: (
      error: ?atom$GetEntriesError,
      // $FlowFixMe
      entries: ?Array<atom$Directory | atom$File>,
    ) => mixed,
  ): void {
    callback(null, []);
  }

  contains(path: ?string): boolean {
    if (path == null) {
      return false;
    }
    return nuclideUri.contains(this._uri, path);
  }
}

/**
 * In contrast to the directory placeholders, the file placeholders never exist.
 * Atom's Git integration, for example, checks for the existence of .git files.
 */
class RemoteFilePlaceholder implements atom$Fileish {
  _uri: string;

  constructor(uri: string) {
    this._uri = uri;
  }

  onDidChange(callback: () => mixed): IDisposable {
    return new UniversalDisposable();
  }

  onDidRename(callback: () => mixed): IDisposable {
    return new UniversalDisposable();
  }

  onDidDelete(callback: () => mixed): IDisposable {
    return new UniversalDisposable();
  }

  onWillThrowWatchError(callback: () => mixed): IDisposable {
    return new UniversalDisposable();
  }

  isFile(): boolean {
    return true;
  }

  isDirectory(): boolean {
    return false;
  }

  exists(): Promise<boolean> {
    return Promise.resolve(false);
  }

  existsSync(): boolean {
    return false;
  }

  getDigestSync(): string {
    return '';
  }

  async getDigest(): Promise<string> {
    return Promise.resolve('');
  }

  setEncoding(encoding: string) {}

  getEncoding(): ?string {
    return null;
  }

  setPath(uri: string): void {
    this._uri = uri;
  }

  getPath(): string {
    return this._uri;
  }

  getRealPathSync(): string {
    return this._uri;
  }

  getRealPath(): Promise<string> {
    return Promise.resolve(this._uri);
  }

  getBaseName(): string {
    return nuclideUri.basename(this._uri);
  }

  create(): Promise<boolean> {
    return Promise.resolve(true);
  }

  delete(): Promise<any> {
    return Promise.resolve();
  }

  copy(newPath: string): Promise<boolean> {
    return Promise.resolve(true);
  }

  read(flushCache?: boolean): Promise<string> {
    return Promise.resolve('');
  }

  readSync(flushCache: boolean): string {
    return '';
  }

  write(text: string): Promise<void> {
    return Promise.resolve();
  }

  getParent(): RemoteDirectoryPlaceholder {
    return new RemoteDirectoryPlaceholder(nuclideUri.dirname(this._uri));
  }

  isSymbolicLink(): boolean {
    return false;
  }

  createReadStream(): stream$Readable {
    const stream = new Stream.Readable({
      read(size) {
        stream.push(null);
      },
    });
    return stream;
  }

  createWriteStream(): stream$Writable {
    throw new Error('Cannot write to a RemoteFilePlaceholder');
  }
}
