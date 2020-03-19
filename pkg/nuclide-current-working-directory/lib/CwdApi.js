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

import type {Directory} from '../../nuclide-remote-connection';

import {memoize} from 'lodash';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nuclideUri from 'nuclide-commons/nuclideUri';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import * as FileTreeHelpers from '../../nuclide-file-tree/lib/FileTreeHelpers';
import {BehaviorSubject, Observable, ReplaySubject} from 'rxjs';

export default class CwdApi implements nuclide$CwdApi {
  _explicitlySetPaths: BehaviorSubject<?string>;
  _disposed: ReplaySubject<void> = new ReplaySubject(1);

  constructor(initialPath: ?string) {
    this._explicitlySetPaths = new BehaviorSubject(initialPath);
  }

  setCwd(path: string): void {
    if (getDirectory(path) == null) {
      throw new Error(`Path does not belong to a project root: ${path}`);
    }
    this._explicitlySetPaths.next(path);
  }

  observeCwd(callback: (path: ?string) => void): IDisposable {
    return new UniversalDisposable(
      this._getPaths().subscribe(path => {
        callback(path);
      }),
    );
  }

  dispose(): void {
    this._disposed.next();
  }

  /**
   * Create an observable that represents the CWD path changes.
   */
  _getPaths = memoize(() => {
    // Since adding and removing projects can affect the validity of cwdPath, we need to re-query
    // every time it happens.
    const projectPathChanges = observableFromSubscribeFunction(cb =>
      atom.project.onDidChangePaths(cb),
    )
      .mapTo(null)
      .share();

    return Observable.merge(this._explicitlySetPaths, projectPathChanges)
      .map(() => this.getCwd())
      .distinctUntilChanged()
      .takeUntil(this._disposed);
  });

  _getDefaultPath(): ?string {
    for (const directory of atom.project.getDirectories()) {
      if (isValidDirectory(directory)) {
        return directory.getPath();
      }
    }
    return null;
  }

  getCwd(): ?string {
    if (isValidDirectoryPath(this._explicitlySetPaths.getValue())) {
      return this._explicitlySetPaths.getValue();
    } else if (isValidDirectoryPath(this._getDefaultPath())) {
      return this._getDefaultPath();
    }
    return null;
  }
}

function getDirectory(path: ?string): ?Directory {
  if (path == null) {
    return null;
  }
  for (const directory of atom.project.getDirectories()) {
    if (!isValidDirectory(directory)) {
      continue;
    }
    const dirPath = directory.getPath();
    if (nuclideUri.contains(dirPath, path)) {
      const relative = nuclideUri.relative(dirPath, path);
      return directory.getSubdirectory(relative);
    }
  }
}

function isValidDirectoryPath(path: ?string): boolean {
  return getDirectory(path) != null;
}

function isValidDirectory(directory: ?Directory): boolean {
  if (directory == null) {
    return true;
  }
  return FileTreeHelpers.isValidDirectory(directory);
}
