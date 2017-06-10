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

import fsPromise from 'nuclide-commons/fsPromise';
import invariant from 'assert';

import {uriToPath, pathToUri} from './helpers';
import File from './File';

/**
 * Handles registering files encountered during debugging with the Chrome debugger
 */
export default class FileCache {
  _sendServerMethod: (method: string, params: ?Object) => mixed;
  _files: Map<string, File>;
  _realpathCache: Object;

  constructor(sendServerMethod: (method: string, params: ?Object) => mixed) {
    this._sendServerMethod = sendServerMethod;
    this._files = new Map();
    this._realpathCache = {};
  }

  async registerFile(fileUrl: string): Promise<File> {
    const filepath = uriToPath(fileUrl);
    let realFilepath;
    try {
      realFilepath = await fsPromise.realpath(filepath, this._realpathCache);
    } catch (error) {
      realFilepath = filepath;
    }
    if (!this._files.has(filepath)) {
      this._files.set(filepath, new File(filepath));
      this._sendServerMethod('Debugger.scriptParsed', {
        scriptId: filepath,
        url: pathToUri(realFilepath),
        startLine: 0,
        startColumn: 0,
        endLine: 0,
        endColumn: 0,
      });
    }
    const result = this._files.get(filepath);
    invariant(result != null);
    return result;
  }

  async getFileSource(filepath: string): Promise<string> {
    const file = await this.registerFile(filepath);
    return file.getSource();
  }
}
