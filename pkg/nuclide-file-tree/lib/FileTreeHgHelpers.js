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

import type {FileTreeNode} from './FileTreeNode';
import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {shell} from 'electron';
import Immutable from 'immutable';
import nuclideUri from 'nuclide-commons/nuclideUri';
import FileTreeHelpers from './FileTreeHelpers';
import {triggerAfterWait} from 'nuclide-commons/promise';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';

const MOVE_TIMEOUT = 10000;

function getHgRepositoryForNode(node: FileTreeNode): ?HgRepositoryClient {
  const repository = node.repo;
  if (repository != null && repository.getType() === 'hg') {
    return ((repository: any): HgRepositoryClient);
  }
  return null;
}

/**
 * Determines whether renaming the given node to the specified destPath is an
 * acceptable rename.
 */
function isValidRename(node: FileTreeNode, destPath_: NuclideUri): boolean {
  let destPath = destPath_;
  const path = FileTreeHelpers.keyToPath(node.uri);
  const rootPath = FileTreeHelpers.keyToPath(node.rootUri);

  destPath = FileTreeHelpers.keyToPath(destPath);

  return (
    FileTreeHelpers.getEntryByKey(node.uri) != null &&
    // This will only detect exact equalities, mostly preventing moves of a
    // directory into itself from causing an error. If a case-changing rename
    // should be a noop for the current OS's file system, this is handled by the
    // fs module.
    path !== destPath &&
    // Disallow renames where the destination is a child of the source node.
    !nuclideUri.contains(path, nuclideUri.dirname(destPath)) &&
    // Disallow renames across projects for the time being, since cross-host and
    // cross-repository moves are a bit tricky.
    nuclideUri.contains(rootPath, destPath)
  );
}

/**
 * Renames a single node to the new path.
 */
async function renameNode(
  node: FileTreeNode,
  destPath: NuclideUri,
): Promise<void> {
  if (!isValidRename(node, destPath)) {
    return;
  }
  const filePath = FileTreeHelpers.keyToPath(node.uri);

  // Need to update the paths in editors before the rename to prevent them from closing
  // In case of an error - undo the editor paths rename
  FileTreeHelpers.updatePathInOpenedEditors(filePath, destPath);
  try {
    const service = getFileSystemServiceByNuclideUri(filePath);
    // Throws if the destPath already exists.
    await service.rename(filePath, destPath);

    const hgRepository = getHgRepositoryForNode(node);
    if (hgRepository == null) {
      return;
    }
    await hgRepository.rename([filePath], destPath, true /* after */);
  } catch (err) {
    FileTreeHelpers.updatePathInOpenedEditors(destPath, filePath);
    throw err;
  }
}

/**
 * Lock on move to prevent concurrent moves, which may lead to race conditions
 * with the hg wlock.
 */
let isMoving = false;

function resetIsMoving() {
  isMoving = false;
}

/**
 * Moves an array of nodes into the destPath, ignoring nodes that cannot be moved.
 * This wrapper prevents concurrent move operations.
 */
async function moveNodes(
  nodes: Array<FileTreeNode>,
  destPath: NuclideUri,
): Promise<void> {
  if (isMoving) {
    return;
  }
  isMoving = true;

  // Reset isMoving to false whenever move operation completes, errors, or times out.
  await triggerAfterWait(
    _moveNodesUnprotected(nodes, destPath),
    MOVE_TIMEOUT,
    resetIsMoving /* timeoutFn */,
    resetIsMoving /* cleanupFn */,
  );
}

async function _moveNodesUnprotected(
  nodes: Array<FileTreeNode>,
  destPath: NuclideUri,
): Promise<void> {
  let paths = [];

  try {
    const filteredNodes = nodes.filter(node => isValidRename(node, destPath));
    // Collapse paths that are in the same subtree, keeping only the subtree root.
    paths = nuclideUri.collapse(
      filteredNodes.map(node => FileTreeHelpers.keyToPath(node.uri)),
    );

    if (paths.length === 0) {
      return;
    }

    // Need to update the paths in editors before the rename to prevent them from closing
    // In case of an error - undo the editor paths rename
    paths.forEach(path => {
      const newPath = nuclideUri.join(destPath, nuclideUri.basename(path));
      FileTreeHelpers.updatePathInOpenedEditors(path, newPath);
    });

    const service = getFileSystemServiceByNuclideUri(paths[0]);
    await service.move(paths, destPath);

    // All filtered nodes should have the same rootUri, so we simply attempt to
    // retrieve the hg repository using the first node.
    const hgRepository = getHgRepositoryForNode(filteredNodes[0]);
    if (hgRepository == null) {
      return;
    }
    await hgRepository.rename(paths, destPath, true /* after */);
  } catch (e) {
    // Restore old editor paths upon error.
    paths.forEach(path => {
      const newPath = nuclideUri.join(destPath, nuclideUri.basename(path));
      FileTreeHelpers.updatePathInOpenedEditors(newPath, path);
    });
    throw e;
  }
}

/**
 * Deletes an array of nodes.
 */
async function deleteNodes(nodes: Array<FileTreeNode>): Promise<void> {
  // Filter out children nodes to avoid ENOENTs that happen when parents are
  // deleted before its children. Convert to List so we can use groupBy.
  const paths = Immutable.List(
    nuclideUri.collapse(nodes.map(node => FileTreeHelpers.keyToPath(node.uri))),
  );
  const localPaths = paths.filter(path => nuclideUri.isLocal(path));
  const remotePaths = paths.filter(path => nuclideUri.isRemote(path));

  // 1) Move local nodes to trash.
  localPaths.forEach(path => shell.moveItemToTrash(path));

  // 2) Batch delete remote nodes, one request per hostname.
  if (remotePaths.size > 0) {
    const pathsByHost = remotePaths.groupBy(path =>
      nuclideUri.getHostname(path),
    );

    await Promise.all(
      pathsByHost.map(async pathGroup => {
        // Batch delete using fs service.
        const service = getFileSystemServiceByNuclideUri(pathGroup.get(0));
        await service.rmdirAll(pathGroup.toJS());
      }),
    );
  }

  // 3) Batch hg remove nodes that belong to an hg repo, one request per repo.
  const nodesByHgRepository = Immutable.List(nodes)
    .filter(node => getHgRepositoryForNode(node) != null)
    .groupBy(node => getHgRepositoryForNode(node))
    .entrySeq();

  await Promise.all(
    nodesByHgRepository.map(async ([hgRepository, repoNodes]) => {
      const hgPaths = nuclideUri.collapse(
        repoNodes.map(node => FileTreeHelpers.keyToPath(node.uri)).toJS(),
      );
      await hgRepository.remove(hgPaths, true /* after */);
    }),
  );
}

export default {
  getHgRepositoryForNode,
  isValidRename,
  renameNode,
  moveNodes,
  deleteNodes,
};
