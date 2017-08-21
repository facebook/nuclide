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

export type FilePath = string;
export type TimeStamp = number;
export type FileList = Array<{path: FilePath, timestamp: TimeStamp}>;

import {CompositeDisposable} from 'atom';

export default class RecentFilesService {
  // Map uses `Map`'s insertion ordering to keep files in order.
  _fileList: Map<FilePath, TimeStamp>;
  _subscriptions: CompositeDisposable;

  constructor(state: ?{filelist?: FileList}) {
    this._fileList = new Map();
    if (state != null && state.filelist != null) {
      // Serialized state is in reverse chronological order. Reverse it to insert items correctly.
      state.filelist.reduceRight((_, fileItem) => {
        this._fileList.set(fileItem.path, fileItem.timestamp);
      }, null);
    }
    this._subscriptions = new CompositeDisposable();
    this._subscriptions.add(
      atom.workspace.onDidStopChangingActivePaneItem((item: ?mixed) => {
        // Not all `item`s are instances of TextEditor (e.g. the diff view).
        // flowlint-next-line sketchy-null-mixed:off
        if (!item || typeof item.getPath !== 'function') {
          return;
        }
        const editorPath = item.getPath();
        if (editorPath != null) {
          this.touchFile(editorPath);
        }
      }),
    );
  }

  touchFile(path: string): void {
    // Delete first to force a new insertion.
    this._fileList.delete(path);
    this._fileList.set(path, Date.now());
  }

  /**
   * Returns a reverse-chronological list of recently opened files.
   */
  getRecentFiles(): FileList {
    return Array.from(this._fileList).reverse().map(pair => ({
      path: pair[0],
      timestamp: pair[1],
    }));
  }

  dispose() {
    this._subscriptions.dispose();
  }
}
