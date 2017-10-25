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

import fs from 'fs';

export class ZipNodeStats extends fs.Stats {
  _isDirectory: boolean;
  _isSymbolicLink: boolean;

  constructor(outer: fs.Stats, entry: any) {
    super();
    const header = entry.header;

    this.dev = outer.dev;
    this.ino = outer.ino;
    this.mode = modeFromZipAttr(header.attr);
    this.nlink = 1; // TODO: figure out directory link count?
    this.uid = outer.uid;
    this.gid = outer.gid;
    this.rdev = outer.rdev;
    this.size = header.size;
    this.blksize = outer.blksize;
    this.blocks = Math.floor((header.compressedSize - 1) / outer.blksize) + 1;
    this.atime = header.time;
    this.mtime = header.time;
    this.ctime = outer.ctime;

    this._isDirectory = entry.isDirectory;
    this._isSymbolicLink = isSymbolicLinkAttr(header.attr);
  }

  isFile(): boolean {
    return !this.isDirectory() && !this.isSymbolicLink();
  }

  isDirectory(): boolean {
    return this._isDirectory;
  }

  isBlockDevice(): boolean {
    return false;
  }

  isCharacterDevice(): boolean {
    return false;
  }

  isSymbolicLink(): boolean {
    return this._isSymbolicLink;
  }

  isFIFO(): boolean {
    return false;
  }

  isSocket(): boolean {
    return false;
  }
}

function modeFromZipAttr(attr: number): number {
  // eslint-disable-next-line no-bitwise
  return attr >>> 16;
}

// eslint-disable-next-line no-bitwise
const ATTR_FILETYPE_MASK = 0xf << 28;
// eslint-disable-next-line no-bitwise
const ATTR_FILETYPE_SYMLINK = 0xa << 28;

function isSymbolicLinkAttr(attr: number): boolean {
  // eslint-disable-next-line no-bitwise
  return (attr & ATTR_FILETYPE_MASK) === ATTR_FILETYPE_SYMLINK;
}
