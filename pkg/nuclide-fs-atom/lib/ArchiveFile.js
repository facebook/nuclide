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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {ArchiveFileSystem} from './ArchiveFileSystem';
import type {ParentDirectory} from './common';

import nuclideUri from 'nuclide-commons/nuclideUri';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {getParentDir, rejectWrite, rejectWriteSync} from './common';
import Stream from 'stream';

export class ArchiveFile implements atom$Fileish {
  _fs: ArchiveFileSystem;
  _path: NuclideUri;
  _encoding: string;

  constructor(path: NuclideUri, fs: ArchiveFileSystem) {
    this._fs = fs;
    this._path = path;
    this._encoding = 'utf8';
  }

  create(): Promise<boolean> {
    return rejectWrite();
  }

  isFile(): boolean {
    return true;
  }

  isDirectory(): boolean {
    return false;
  }

  exists(): Promise<boolean> {
    return this._fs.exists(this._path);
  }

  existsSync(): boolean {
    return true;
  }

  setEncoding(encoding: string): void {
    this._encoding = encoding;
  }

  getEncoding(): string {
    return this._encoding;
  }

  onDidRename(callback: () => void): IDisposable {
    return new UniversalDisposable();
  }

  onDidDelete(callback: () => void): IDisposable {
    return new UniversalDisposable();
  }

  onDidChange(callback: () => void): IDisposable {
    return new UniversalDisposable();
  }

  onWillThrowWatchError(callback: () => mixed): IDisposable {
    return new UniversalDisposable();
  }

  getPath(): NuclideUri {
    return this._path;
  }

  getBaseName(): string {
    return nuclideUri.basename(this._path);
  }

  getParent(): ParentDirectory {
    return getParentDir(this._fs, this._path);
  }

  createReadStream(): stream$Readable {
    let started = false;
    const createStream = () => this._fs.createReadStream(this._path);
    const stream = new Stream.Readable({
      read(size) {
        if (!started) {
          started = true;
          const disposer = new UniversalDisposable();
          const inner = createStream();
          disposer.add(
            inner.subscribe(
              buffer => {
                stream.push(buffer);
              },
              err => {
                stream.emit('error', err);
                disposer.dispose();
              },
              () => {
                stream.push(null);
                disposer.dispose();
              },
            ),
            inner.connect(),
          );
        }
      },
    });
    return stream;
  }

  createWriteStream(): stream$Writable {
    throw new Error('Archive files do not support writing.');
  }

  read(flushCache?: boolean): Promise<string> {
    const encoding: any = this._encoding;
    return this._fs
      .readFile(this._path)
      .then(buffer => buffer.toString(encoding));
  }

  write(text: string): Promise<void> {
    return rejectWrite();
  }

  writeSync(text: string): void {
    rejectWriteSync();
  }
}
