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

import RelatedFileFinder from './RelatedFileFinder';
import {trackTiming} from '../../nuclide-analytics';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';

/**
 * Sets up listeners so the user can jump to related files.
 *
 * Clients must call `dispose()` once they're done with an instance.
 */
export default class JumpToRelatedFile {
  _subscription: IDisposable;

  constructor() {
    this._subscription = atom.commands.add('atom-workspace', {
      'nuclide-related-files:switch-between-header-source': () => {
        const editor = atom.workspace.getActiveTextEditor();
        if (editor == null) {
          return;
        }
        const path = editor.getPath();
        if (path) {
          trackTiming(
            'nuclide-related-files:switch-between-header-source',
            async () => this._open(await this.getNextRelatedFile(path)),
          );
        }
      },
      'nuclide-related-files:jump-to-next-related-file': () => {
        const editor = atom.workspace.getActiveTextEditor();
        if (editor == null) {
          return;
        }
        const path = editor.getPath();
        if (path) {
          trackTiming(
            'nuclide-related-files:jump-to-next-related-file',
            async () => this._open(await this.getNextRelatedFile(path)),
          );
        }
      },
      'nuclide-related-files:jump-to-previous-related-file': () => {
        const editor = atom.workspace.getActiveTextEditor();
        if (editor == null) {
          return;
        }
        const path = editor.getPath();
        if (path) {
          trackTiming(
            'nuclide-related-files:jump-to-previous-related-file',
            async () => this._open(await this.getPreviousRelatedFile(path)),
          );
        }
      },
    });
  }

  dispose(): void {
    this._subscription.dispose();
  }

  /**
   * Gets the next related file, which Xcode defines as the one that comes
   * before the current one alphabetically.
   */
  async getNextRelatedFile(path: string): Promise<string> {
    const {relatedFiles, index} = await RelatedFileFinder.find(
      path,
      this._getFileTypeWhitelist(),
    );
    if (index === -1) {
      return path;
    }
    return relatedFiles[
      (relatedFiles.length + index - 1) % relatedFiles.length
    ];
  }

  /**
   * Gets the previous related file, which Xcode defines as the one that comes
   * after the current one alphabetically.
   */
  async getPreviousRelatedFile(path: string): Promise<string> {
    const {relatedFiles, index} = await RelatedFileFinder.find(
      path,
      this._getFileTypeWhitelist(),
    );
    if (index === -1) {
      return path;
    }
    return relatedFiles[(index + 1) % relatedFiles.length];
  }

  _getFileTypeWhitelist(): Set<string> {
    const fileTypeWhitelist: Array<string> = (featureConfig.get(
      'nuclide-related-files.fileTypeWhitelist',
    ): any);
    return new Set(fileTypeWhitelist);
  }

  _open(path: string) {
    if (featureConfig.get('nuclide-related-files.openInNextPane')) {
      atom.workspace.activateNextPane();
    }
    goToLocation(path);
  }
}
