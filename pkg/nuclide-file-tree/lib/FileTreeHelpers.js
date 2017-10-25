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
import type {
  RemoteDirectory,
  RemoteFile,
} from '../../nuclide-remote-connection';
import type {ShowUncommittedChangesKindValue} from './Constants';

import {
  ShowUncommittedChangesKind,
  SHOW_UNCOMMITTED_CHANGES_KIND_CONFIG_KEY,
} from './Constants';
import {Directory as LocalDirectory} from 'atom';
import {File as LocalFile} from 'atom';
import {
  RemoteConnection,
  ServerConnection,
} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {cacheWhileSubscribed} from 'nuclide-commons/observable';
import {Observable} from 'rxjs';
import passesGK from '../../commons-node/passesGK';
import invariant from 'assert';
import crypto from 'crypto';
import os from 'os';
import {ROOT_ARCHIVE_FS} from '../../nuclide-fs-atom';

export type Directory = LocalDirectory | RemoteDirectory;
type File = LocalFile | RemoteFile;
type Entry = LocalDirectory | RemoteDirectory | LocalFile | RemoteFile;

export type SelectionMode =
  | 'single-select'
  | 'multi-select'
  | 'range-select'
  | 'invalid-select';

function dirPathToKey(path: string): string {
  return nuclideUri.ensureTrailingSeparator(
    nuclideUri.trimTrailingSeparator(path),
  );
}

function isDirOrArchiveKey(key: string): boolean {
  return (
    nuclideUri.endsWithSeparator(key) ||
    nuclideUri.hasKnownArchiveExtension(key)
  );
}

function keyToName(key: string): string {
  return nuclideUri.basename(key);
}

function keyToPath(key: string): string {
  return nuclideUri.trimTrailingSeparator(key);
}

function getParentKey(key: string): string {
  return nuclideUri.ensureTrailingSeparator(nuclideUri.dirname(key));
}

// The array this resolves to contains the `nodeKey` of each child
function fetchChildren(nodeKey: string): Promise<Array<string>> {
  const directory = getDirectoryByKey(nodeKey);

  return new Promise((resolve, reject) => {
    if (directory == null) {
      reject(new Error(`Directory "${nodeKey}" not found or is inaccessible.`));
      return;
    }

    // $FlowIssue https://github.com/facebook/flow/issues/582
    directory.getEntries((error, entries_) => {
      let entries = entries_;
      // Resolve to an empty array if the directory deson't exist.
      // TODO: should we reject promise?
      if (error && error.code !== 'ENOENT') {
        reject(error);
        return;
      }
      entries = entries || [];
      const keys = entries.map(entry => {
        const path = entry.getPath();
        if (entry.isDirectory()) {
          return dirPathToKey(path);
        } else {
          return path;
        }
      });
      resolve(keys);
    });
  });
}

function getDirectoryByKey(key: string): ?Directory {
  const path = keyToPath(key);
  if (!isDirOrArchiveKey(key)) {
    return null;
  } else if (nuclideUri.isRemote(path)) {
    const connection = ServerConnection.getForUri(path);
    if (connection == null) {
      return null;
    }
    if (nuclideUri.hasKnownArchiveExtension(key)) {
      return connection.createFileAsDirectory(path);
    } else {
      return connection.createDirectory(path);
    }
  } else if (nuclideUri.hasKnownArchiveExtension(key)) {
    return ROOT_ARCHIVE_FS.newArchiveFileAsDirectory(path);
  } else if (!nuclideUri.isInArchive(path)) {
    return new LocalDirectory(path);
  } else {
    return ROOT_ARCHIVE_FS.newArchiveDirectory(path);
  }
}

function getFileByKey(key: string): ?File {
  const path = keyToPath(key);
  if (isDirOrArchiveKey(key)) {
    return null;
  } else if (nuclideUri.isRemote(path)) {
    const connection = ServerConnection.getForUri(path);
    if (connection == null) {
      return null;
    }
    return connection.createFile(path);
  } else if (!nuclideUri.isInArchive(path)) {
    return new LocalFile(path);
  } else {
    return ROOT_ARCHIVE_FS.newArchiveFile(path);
  }
}

function getEntryByKey(key: string): ?Entry {
  return getFileByKey(key) || getDirectoryByKey(key);
}

function getDisplayTitle(key: string): ?string {
  const path = keyToPath(key);

  if (nuclideUri.isRemote(path)) {
    const connection = RemoteConnection.getForUri(path);

    if (connection != null) {
      return connection.getDisplayTitle();
    }
  }
}

// Sometimes remote directories are instantiated as local directories but with invalid paths.
// Also, until https://github.com/atom/atom/issues/10297 is fixed in 1.12,
// Atom sometimes creates phantom "atom:" directories when opening atom:// URIs.
function isValidDirectory(directory: Directory): boolean {
  if (!isLocalEntry((directory: any))) {
    return true;
  }

  const dirPath = directory.getPath();
  return nuclideUri.isAbsolute(dirPath);
}

function isLocalEntry(entry: Entry): boolean {
  // TODO: implement `RemoteDirectory.isRemoteDirectory()`
  return !('getLocalPath' in entry);
}

function isContextClick(event: SyntheticMouseEvent<>): boolean {
  return (
    event.button === 2 ||
    (event.button === 0 &&
      event.ctrlKey === true &&
      process.platform === 'darwin')
  );
}

function buildHashKey(nodeKey: string): string {
  return crypto
    .createHash('MD5')
    .update(nodeKey)
    .digest('base64');
}

function observeUncommittedChangesKindConfigKey(): Observable<
  ShowUncommittedChangesKindValue,
> {
  return cacheWhileSubscribed(
    featureConfig
      .observeAsStream(SHOW_UNCOMMITTED_CHANGES_KIND_CONFIG_KEY)
      .map(setting => {
        // We need to map the unsanitized feature-setting string
        // into a properly typed value:
        switch (setting) {
          case ShowUncommittedChangesKind.HEAD:
            return ShowUncommittedChangesKind.HEAD;
          case ShowUncommittedChangesKind.STACK:
            return ShowUncommittedChangesKind.STACK;
          default:
            return ShowUncommittedChangesKind.UNCOMMITTED;
        }
      })
      .distinctUntilChanged(),
  );
}

function updatePathInOpenedEditors(
  oldPath: NuclideUri,
  newPath: NuclideUri,
): void {
  atom.workspace.getTextEditors().forEach(editor => {
    const buffer = editor.getBuffer();
    const bufferPath = buffer.getPath();
    if (bufferPath == null) {
      return;
    }

    if (nuclideUri.contains(oldPath, bufferPath)) {
      const relativeToOld = nuclideUri.relative(oldPath, bufferPath);
      const newBufferPath = nuclideUri.join(newPath, relativeToOld);
      // setPath() doesn't work correctly with remote files.
      // We need to create a new remote file and reset the underlying file.
      const file = getFileByKey(newBufferPath);
      invariant(
        file != null,
        `Could not update open file ${oldPath} to ${newBufferPath}`,
      );
      buffer.setFile(file);
    }
  });
}

function areStackChangesEnabled(): Promise<boolean> {
  return passesGK('nuclide_file_tree_stack_changes');
}

function getSelectionMode(event: SyntheticMouseEvent<>): SelectionMode {
  if (
    (os.platform() === 'darwin' && event.metaKey && event.button === 0) ||
    (os.platform() !== 'darwin' && event.ctrlKey && event.button === 0)
  ) {
    return 'multi-select';
  }
  if (os.platform() === 'darwin' && event.ctrlKey && event.button === 0) {
    return 'single-select';
  }
  if (event.shiftKey && event.button === 0) {
    return 'range-select';
  }
  if (!event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    return 'single-select';
  }
  return 'invalid-select';
}

export default {
  dirPathToKey,
  isDirOrArchiveKey,
  keyToName,
  keyToPath,
  getParentKey,
  fetchChildren,
  getDirectoryByKey,
  getEntryByKey,
  getFileByKey,
  getDisplayTitle,
  isValidDirectory,
  isLocalEntry,
  isContextClick,
  buildHashKey,
  observeUncommittedChangesKindConfigKey,
  updatePathInOpenedEditors,
  areStackChangesEnabled,
  getSelectionMode,
};
