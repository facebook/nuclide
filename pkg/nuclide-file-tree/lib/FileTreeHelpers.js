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
import type {FileTreeNode} from './FileTreeNode';
import type {Roots} from './types';

import {
  ShowUncommittedChangesKind,
  SHOW_UNCOMMITTED_CHANGES_KIND_CONFIG_KEY,
} from './Constants';
import {Directory as LocalDirectory} from 'atom';
import {File as LocalFile} from 'atom';
import {
  RemoteConnection,
  ServerConnection,
  RemoteDirectoryPlaceholder,
} from '../../nuclide-remote-connection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {cacheWhileSubscribed} from 'nuclide-commons/observable';
import {Observable} from 'rxjs';
import invariant from 'assert';
import os from 'os';

export type Directory =
  | LocalDirectory
  | RemoteDirectory
  | RemoteDirectoryPlaceholder;
type File = LocalFile | RemoteFile;
type Entry = Directory | File;

export type SelectionMode =
  | 'single-select'
  | 'multi-select'
  | 'range-select'
  | 'invalid-select';

export function dirPathToKey(path: string): string {
  return nuclideUri.ensureTrailingSeparator(
    nuclideUri.trimTrailingSeparator(path),
  );
}

export function isDirOrArchiveKey(key: string): boolean {
  return (
    nuclideUri.endsWithSeparator(key) ||
    nuclideUri.hasKnownArchiveExtension(key)
  );
}

export function keyToName(key: string): string {
  return nuclideUri.basename(key);
}

export function keyToPath(key: string): string {
  return nuclideUri.trimTrailingSeparator(key);
}

export function getParentKey(key: string): string {
  return nuclideUri.ensureTrailingSeparator(nuclideUri.dirname(key));
}

// The array this resolves to contains the `nodeKey` of each child
export function fetchChildren(nodeKey: string): Promise<Array<string>> {
  const directory = getDirectoryByKey(nodeKey);

  return new Promise((resolve, reject) => {
    if (directory == null) {
      reject(new Error(`Directory "${nodeKey}" not found or is inaccessible.`));
      return;
    }

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

export function getDirectoryByKey(key: string): ?Directory {
  const path = keyToPath(key);
  if (!isDirOrArchiveKey(key)) {
    return null;
  } else if (nuclideUri.isRemote(path)) {
    const connection = ServerConnection.getForUri(path);
    if (connection == null) {
      // Placeholder remote directories are just empty.
      // These will be removed by nuclide-remote-projects after reconnection, anyway.
      return new RemoteDirectoryPlaceholder(path);
    }
    if (nuclideUri.hasKnownArchiveExtension(key)) {
      return connection.createFileAsDirectory(path);
    } else {
      return connection.createDirectory(path);
    }
  } else {
    return new LocalDirectory(path);
  }
}

export function getFileByKey(key: string): ?File {
  const path = keyToPath(key);
  if (isDirOrArchiveKey(key)) {
    return null;
  } else if (nuclideUri.isRemote(path)) {
    const connection = ServerConnection.getForUri(path);
    if (connection == null) {
      return null;
    }
    return connection.createFile(path);
  } else {
    return new LocalFile(path);
  }
}

export function getEntryByKey(key: string): ?Entry {
  return getFileByKey(key) || getDirectoryByKey(key);
}

export function getDisplayTitle(key: string): ?string {
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
export function isValidDirectory(directory: Directory): boolean {
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

export function isContextClick(event: SyntheticMouseEvent<>): boolean {
  return (
    event.button === 2 ||
    (event.button === 0 &&
      event.ctrlKey === true &&
      process.platform === 'darwin')
  );
}

export function observeUncommittedChangesKindConfigKey(): Observable<
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

export function updatePathInOpenedEditors(
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

export function getSelectionMode(event: SyntheticMouseEvent<>): SelectionMode {
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

/**
 * Replace a node in the tree and return the new tree's root. The newNode is assumed to be prevNode
 * after some manipulateion done to it therefore they are assumed to belong to the same parent.
 *
 * An optional transformation can be provided which will be applied to all of the node's ancestors
 * (including the node itself).
 */
export function replaceNode(
  prevNode: FileTreeNode,
  newNode: FileTreeNode,
  transform: (node: FileTreeNode) => FileTreeNode = node => node,
): FileTreeNode {
  const parent = prevNode.parent;
  if (parent == null) {
    return newNode;
  }

  const newParent = transform(parent.updateChild(newNode));
  return replaceNode(parent, newParent, transform);
}

/**
 * Use the predicate to update a node (or a branch) of the file-tree
 */
export function updateNodeAtRoot(
  roots: Roots,
  rootKey: NuclideUri,
  nodeKey: NuclideUri,
  transform: (node: FileTreeNode) => FileTreeNode,
): Roots {
  const root = roots.get(rootKey);
  if (root == null) {
    return roots;
  }

  const node = root.find(nodeKey);
  if (node == null) {
    return roots;
  }

  return roots.set(rootKey, replaceNode(node, transform(node)));
}

/**
 * Update a node or a branch under any of the roots it was found at
 */
export function updateNodeAtAllRoots(
  roots: Roots,
  nodeKey: NuclideUri,
  transform: (node: FileTreeNode) => FileTreeNode,
): Roots {
  return roots.map(root => {
    const node = root.find(nodeKey);
    if (node == null) {
      return root;
    }
    return replaceNode(node, transform(node));
  });
}
