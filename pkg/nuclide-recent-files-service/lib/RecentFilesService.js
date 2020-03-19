/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type {FileList} from '..';

import * as RecentFilesDB from './RecentFilesDB';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export default class RecentFilesService {
  _subscriptions: UniversalDisposable;

  constructor() {
    this._subscriptions = new UniversalDisposable();
    this._subscriptions.add(
      atom.workspace.onDidChangeActivePaneItem((item: ?mixed) => {
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

  async touchFile(path: string): Promise<void> {
    await RecentFilesDB.touchFileDB(path, Date.now());
  }

  /**
   * Returns a reverse-chronological list of recently opened files.
   */
  async getRecentFiles(): Promise<FileList> {
    const fileList = await RecentFilesDB.getAllRecents();
    return fileList.dump().map(({k, v}) => ({
      resultType: 'FILE',
      path: k,
      timestamp: v,
    }));
  }

  async dispose(): Promise<void> {
    this._subscriptions.dispose();
    // Try one last time to sync back. Changes should be periodically saved,
    // so if this doesn't run before we quit, that's OK. If package deactivation
    // were async, then we could wait for the DB save to complete.
    await RecentFilesDB.syncCache(true);
  }
}
