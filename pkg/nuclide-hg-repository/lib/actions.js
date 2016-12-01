'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */


import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import type {NuclideUri} from '../../commons-node/nuclideUri';

import invariant from 'assert';
import {repositoryForPath} from '../../nuclide-hg-git-bridge';
import {track} from '../../nuclide-analytics';

export function addPath(nodePath: ?NuclideUri): Promise<void> {
  return hgActionToPath(
    nodePath,
    'add',
    'Added',
    async (hgRepository: HgRepositoryClient) => {
      invariant(nodePath);
      track('hg-repository-add', {nodePath});
      await hgRepository.addAll([nodePath]);
    },
  );
}

export function revertPath(nodePath: ?NuclideUri, toRevision?: ?string): Promise<void> {
  return hgActionToPath(
    nodePath,
    'revert',
    'Reverted',
    async (hgRepository: HgRepositoryClient) => {
      invariant(nodePath);
      track('hg-repository-revert', {nodePath});
      await hgRepository.revert([nodePath], toRevision);
    },
  );
}

export function confirmAndRevertPath(path: ?NuclideUri, toRevision?: ?string): void {
  const result = atom.confirm({
    message: 'Are you sure you want to revert?',
    buttons: ['Revert', 'Cancel'],
  });
  invariant(result === 0 || result === 1);
  if (result === 0) {
    revertPath(path, toRevision);
  }
}

async function hgActionToPath(
  nodePath: ?NuclideUri,
  actionName: string,
  actionDoneMessage: string,
  action: (hgRepository: HgRepositoryClient) => Promise<void>,
): Promise<void> {
  if (nodePath == null || nodePath.length === 0) {
    atom.notifications.addError(`Cannot ${actionName} an empty path!`);
    return;
  }
  const repository = repositoryForPath(nodePath);
  if (repository == null || repository.getType() !== 'hg') {
    atom.notifications.addError(`Cannot ${actionName} a non-mercurial repository path`);
    return;
  }
  const hgRepository: HgRepositoryClient = (repository: any);
  try {
    await action(hgRepository);
    atom.notifications.addSuccess(
      `${actionDoneMessage} \`${repository.relativize(nodePath)}\` successfully.`,
    );
  } catch (error) {
    atom.notifications.addError(
      `Failed to ${actionName} \`${repository.relativize(nodePath)}\``,
      {detail: error.message},
    );
  }
}
