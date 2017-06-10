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

import type {Directory} from '../../nuclide-remote-connection';
import type {Observable} from 'rxjs';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import nuclideUri from 'nuclide-commons/nuclideUri';
// eslint-disable-next-line nuclide-internal/no-cross-atom-imports
import FileTreeHelpers from '../../nuclide-file-tree/lib/FileTreeHelpers';
import {BehaviorSubject} from 'rxjs';

export class CwdApi {
  _cwd$: Observable<?Directory>;
  _cwdPath$: BehaviorSubject<?string>;
  _disposables: UniversalDisposable;

  constructor(initialCwdPath: ?string) {
    this._cwdPath$ = new BehaviorSubject(initialCwdPath);
    this._cwd$ = this._cwdPath$
      // Re-check the CWD every time the project paths change.
      // Adding/removing projects can affect the validity of cwdPath.
      .merge(
        observableFromSubscribeFunction(cb =>
          atom.project.onDidChangePaths(cb),
        ).mapTo(null),
      )
      .map(() => this.getCwd())
      .map(directory => (isValidDirectory(directory) ? directory : null))
      .distinctUntilChanged();

    this._disposables = new UniversalDisposable();
  }

  setCwd(path: string): void {
    if (getDirectory(path) == null) {
      throw new Error(`Path does not belong to a project root: ${path}`);
    }
    this._cwdPath$.next(path);
  }

  observeCwd(callback: (directory: ?Directory) => void): IDisposable {
    const disposable = new UniversalDisposable(
      this._cwd$.subscribe(directory => {
        callback(directory);
      }),
    );
    this._disposables.add(disposable);
    return disposable;
  }

  dispose(): void {
    this._disposables.dispose();
  }

  _getDefaultCwdPath(): ?string {
    for (const directory of atom.project.getDirectories()) {
      if (isValidDirectory(directory)) {
        return directory.getPath();
      }
    }
    return null;
  }

  getCwd(): ?Directory {
    return (
      getDirectory(this._cwdPath$.getValue()) ||
      getDirectory(this._getDefaultCwdPath())
    );
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

function isValidDirectory(directory: ?Directory): boolean {
  if (directory == null) {
    return true;
  }
  return FileTreeHelpers.isValidDirectory(directory);
}
