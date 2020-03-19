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

import LineByLineReader from 'line-by-line';

export default class SourceFileCache {
  _files: Map<string, string[]> = new Map();
  _getSourceByReference: (sourceReference: number) => Promise<string>;

  constructor(
    getSourceByReference: (sourceReference: number) => Promise<string>,
  ) {
    this._getSourceByReference = getSourceByReference;
  }

  async getFileDataBySourceReference(
    sourceReference: number,
  ): Promise<string[]> {
    const path = `sourceref://${sourceReference}`;
    let data = this._files.get(path);

    if (data == null) {
      data = await this._fillCacheWithSourceReference(sourceReference);
      this._files.set(path, data);
    }

    return data;
  }

  async getFileDataByPath(path: string): Promise<string[]> {
    let data = this._files.get(path);

    if (data == null) {
      data = await this._fillCacheFromLocalFileSystem(path);
      this._files.set(path, data);
    }

    return data;
  }

  flush(): void {
    this._files = new Map();
  }

  async _fillCacheFromLocalFileSystem(path: string): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const lines: string[] = [];

      // LineByLineReader splits the file on the fly so we don't
      // have to read into memory first
      new LineByLineReader(path)
        .on('line', line => lines.push(line))
        .on('end', () => resolve(lines))
        .on('error', e => reject(e));
    });
  }

  async _fillCacheWithSourceReference(
    sourceReference: number,
  ): Promise<string[]> {
    const data = await this._getSourceByReference(sourceReference);
    return data.split(/\n|\r\n|\r/);
  }
}
