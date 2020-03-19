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

import type {HgRepositoryClient} from '../../nuclide-hg-repository-client/lib/HgRepositoryClient';
import type {IconName} from 'nuclide-commons-ui/Icon';
import type {
  MergeConflictStatusValue,
  StatusCodeNumberValue,
} from '../../nuclide-hg-rpc/lib/types';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import {arrayCompact} from 'nuclide-commons/collection';
import {runCommand} from 'nuclide-commons/process';
import {diffSets} from 'nuclide-commons/observable';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';
import {hgConstants} from '../../nuclide-hg-rpc';
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {Observable} from 'rxjs';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {track} from 'nuclide-analytics';

type VcsInfo = {
  vcs: string,
  root: string,
};

type Repository = atom$Repository | HgRepositoryClient;

const {StatusCodeNumber: HgStatusCodeNumber, MergeConflictStatus} = hgConstants;
const vcsInfoCache: {[dir: string]: VcsInfo} = {};

async function findVcsHelper(dir: string): Promise<VcsInfo> {
  const options = {cwd: dir};
  try {
    return {
      vcs: 'hg',
      root: (await runCommand('hg', ['root'], options).toPromise()).trim(),
    };
  } catch (err) {}

  try {
    return {
      vcs: 'git',
      root: (await runCommand(
        'git',
        ['rev-parse', '--show-toplevel'],
        options,
      ).toPromise()).trim(),
    };
  } catch (err) {}

  throw new Error('Could not find VCS for: ' + dir);
}

/**
 * For the given source file, find the type of vcs that is managing it as well
 * as the root directory for the VCS.
 */
export async function findVcs(dir: string): Promise<VcsInfo> {
  let vcsInfo = vcsInfoCache[dir];
  if (vcsInfo) {
    return vcsInfo;
  }

  vcsInfo = await findVcsHelper(dir);
  vcsInfoCache[dir] = vcsInfo;
  return vcsInfo;
}

export type FileChangeStatusValue = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const FileChangeStatus = Object.freeze({
  ADDED: 1,
  MODIFIED: 2,
  MISSING: 3,
  REMOVED: 4,
  UNTRACKED: 5,
  BOTH_CHANGED: 6,
  CHANGE_DELETE: 7,
});

(FileChangeStatus: {[key: string]: FileChangeStatusValue});

export const HgStatusToFileChangeStatus: {
  [key: StatusCodeNumberValue]: FileChangeStatusValue,
} = Object.freeze({
  [HgStatusCodeNumber.ADDED]: FileChangeStatus.ADDED,
  [HgStatusCodeNumber.MODIFIED]: FileChangeStatus.MODIFIED,
  [HgStatusCodeNumber.MISSING]: FileChangeStatus.MISSING,
  [HgStatusCodeNumber.REMOVED]: FileChangeStatus.REMOVED,
  [HgStatusCodeNumber.UNTRACKED]: FileChangeStatus.UNTRACKED,
});

export const MergeConflictStatusToNumber: {
  [key: MergeConflictStatusValue]: FileChangeStatusValue,
} = {
  [MergeConflictStatus.BOTH_CHANGED]: FileChangeStatus.BOTH_CHANGED,
  [MergeConflictStatus.DELETED_IN_THEIRS]: FileChangeStatus.CHANGE_DELETE,
  [MergeConflictStatus.DELETED_IN_OURS]: FileChangeStatus.CHANGE_DELETE,
};

export const FileChangeStatusToPrefix: {
  [key: FileChangeStatusValue]: string,
} = Object.freeze({
  [FileChangeStatus.ADDED]: '[A] ',
  [FileChangeStatus.MODIFIED]: '[M] ',
  [FileChangeStatus.MISSING]: '[!] ',
  [FileChangeStatus.REMOVED]: '[D] ',
  [FileChangeStatus.UNTRACKED]: '[?] ',
});

export const FileChangeStatusToIcon: {
  [key: ?FileChangeStatusValue]: IconName,
} = Object.freeze({
  [FileChangeStatus.ADDED]: 'diff-added',
  [FileChangeStatus.MODIFIED]: 'diff-modified',
  [FileChangeStatus.MISSING]: 'stop',
  [FileChangeStatus.REMOVED]: 'diff-removed',
  [FileChangeStatus.UNTRACKED]: 'question',
  [FileChangeStatus.BOTH_CHANGED]: 'alignment-unalign ',
  [FileChangeStatus.CHANGE_DELETE]: 'x ',
});

export const FileChangeStatusToTextColor: {
  [key: ?FileChangeStatusValue]: string,
} = Object.freeze({
  [FileChangeStatus.ADDED]: 'status-added',
  [FileChangeStatus.MODIFIED]: 'status-modified',
  [FileChangeStatus.MISSING]: 'status-renamed',
  [FileChangeStatus.REMOVED]: 'status-removed',
  [FileChangeStatus.UNTRACKED]: 'status-ignored',
  [FileChangeStatus.BOTH_CHANGED]: 'text-warning',
  [FileChangeStatus.CHANGE_DELETE]: 'text-warning',
});

export const FileChangeStatusToLabel: {
  [key: ?FileChangeStatusValue]: string,
} = Object.freeze({
  [FileChangeStatus.ADDED]: 'Added',
  [FileChangeStatus.MODIFIED]: 'Modified',
  [FileChangeStatus.MISSING]: 'Missing',
  [FileChangeStatus.REMOVED]: 'Removed',
  [FileChangeStatus.UNTRACKED]: 'Untracked',
  [FileChangeStatus.BOTH_CHANGED]: 'Both Changed',
  [FileChangeStatus.CHANGE_DELETE]: 'Deleted',
});

export const RevertibleStatusCodes = [
  FileChangeStatus.ADDED,
  FileChangeStatus.MODIFIED,
  FileChangeStatus.REMOVED,
];

export const DIFF_EDITOR_MARKER_CLASS = 'nuclide-diff-editor-marker';

export function getDirtyFileChanges(
  repository: HgRepositoryClient,
): Map<NuclideUri, FileChangeStatusValue> {
  const dirtyFileChanges = new Map();
  const statuses = repository.getAllPathStatuses();
  for (const filePath in statuses) {
    const changeStatus = HgStatusToFileChangeStatus[statuses[filePath]];
    if (changeStatus != null) {
      dirtyFileChanges.set(filePath, changeStatus);
    }
  }
  return dirtyFileChanges;
}

export function observeStatusChanges(
  repository: HgRepositoryClient,
): Observable<Map<NuclideUri, FileChangeStatusValue>> {
  return observableFromSubscribeFunction(
    repository.onDidChangeStatuses.bind(repository),
  )
    .startWith(null)
    .map(() => getDirtyFileChanges(repository));
}

export function forgetPath(
  repository: ?Repository,
  nodePath: ?NuclideUri,
): Promise<void> {
  return hgActionToPath(
    repository,
    nodePath,
    'forget',
    'Forgot',
    async (hgRepository: HgRepositoryClient) => {
      // flowlint-next-line sketchy-null-string:off
      invariant(nodePath);
      track('hg-repository-forget', {nodePath});
      await hgRepository.forget([nodePath]);
    },
  );
}

export function addPath(
  repository: ?Repository,
  nodePath: ?NuclideUri,
): Promise<void> {
  return hgActionToPath(
    repository,
    nodePath,
    'add',
    'Added',
    async (hgRepository: HgRepositoryClient) => {
      // flowlint-next-line sketchy-null-string:off
      invariant(nodePath);
      track('hg-repository-add', {nodePath});
      await hgRepository.addAll([nodePath]);
    },
  );
}

export function revertPath(
  repository: ?Repository,
  nodePath: ?NuclideUri,
  toRevision?: ?string,
): Promise<void> {
  return hgActionToPath(
    repository,
    nodePath,
    'revert',
    'Reverted',
    async (hgRepository: HgRepositoryClient) => {
      // flowlint-next-line sketchy-null-string:off
      invariant(nodePath);
      track('hg-repository-revert', {nodePath});
      await hgRepository.revert([nodePath], toRevision);
    },
  );
}

export function confirmAndRevertPath(
  repository: ?Repository,
  path: ?NuclideUri,
  toRevision?: ?string,
): void {
  const result = atom.confirm({
    message: `Are you sure you want to revert${
      path == null ? '' : ` "${path}"`
    }?`,
    buttons: ['Revert', 'Cancel'],
  });
  invariant(result === 0 || result === 1);
  if (result === 0) {
    revertPath(repository, path, toRevision);
  }
}

async function hgActionToPath(
  repository: ?Repository,
  nodePath: ?NuclideUri,
  actionName: string,
  actionDoneMessage: string,
  action: (hgRepository: HgRepositoryClient) => Promise<void>,
): Promise<void> {
  if (nodePath == null || nodePath.length === 0) {
    atom.notifications.addError(`Cannot ${actionName} an empty path!`);
    return;
  }
  if (repository == null || repository.getType() !== 'hg') {
    atom.notifications.addError(
      `Cannot ${actionName} a non-mercurial repository path`,
    );
    return;
  }
  const hgRepository: HgRepositoryClient = (repository: any);
  try {
    await action(hgRepository);
    atom.notifications.addSuccess(
      `${actionDoneMessage} \`${repository.relativize(
        nodePath,
      )}\` successfully.`,
    );
  } catch (error) {
    atom.notifications.addError(
      `Failed to ${actionName} \`${repository.relativize(nodePath)}\``,
      {detail: error.message},
    );
  }
}

export function getHgRepositories(): Set<HgRepositoryClient> {
  return new Set(
    (arrayCompact(atom.project.getRepositories())
      // Flow doesn't understand that this filters to hg repositories only, so cast through `any`
      .filter(repository => repository.getType() === 'hg'): Array<any>),
  );
}

export function getHgRepositoriesStream(): Observable<Set<HgRepositoryClient>> {
  return observableFromSubscribeFunction(
    atom.project.onDidChangePaths.bind(atom.project),
  )
    .startWith(null)
    .map(() => getHgRepositories());
}

export function getHgRepositoryStream(): Observable<HgRepositoryClient> {
  return getHgRepositoriesStream()
    .let(diffSets())
    .flatMap(repoDiff => Observable.from(repoDiff.added));
}

/**
 * @param aPath The NuclideUri of a file or directory for which you want to find
 *   a Repository it belongs to.
 * @return A Git or Hg repository the path belongs to, if any.
 */
export function repositoryForPath(aPath: NuclideUri): ?atom$Repository {
  // Calling atom.project.repositoryForDirectory gets the real path of the directory,
  // which requires a round-trip to the server for remote paths.
  // Instead, this function keeps filtering local.
  const repositories = arrayCompact(atom.project.getRepositories());
  return repositories.find(repo => {
    try {
      return repositoryContainsPath(repo, aPath);
    } catch (e) {
      // The repo type is not supported.
      return false;
    }
  });
}

/**
 * @param repository Either a GitRepository or HgRepositoryClient.
 * @param filePath The absolute file path of interest.
 * @return boolean Whether the file path exists within the working directory
 *   (aka root directory) of the repository, or is the working directory.
 */
export function repositoryContainsPath(
  repository: atom$Repository,
  filePath: NuclideUri,
): boolean {
  return nuclideUri.contains(repository.getWorkingDirectory(), filePath);
}

export function getMultiRootFileChanges(
  fileChanges: Map<NuclideUri, FileChangeStatusValue>,
  rootPaths?: Array<NuclideUri>,
): Map<NuclideUri, Map<NuclideUri, FileChangeStatusValue>> {
  let roots;
  if (rootPaths == null) {
    roots = arrayCompact(
      atom.project.getDirectories().map(directory => {
        const rootPath = directory.getPath();
        const repository = repositoryForPath(rootPath);
        if (repository == null || repository.getType() !== 'hg') {
          return null;
        }
        return nuclideUri.ensureTrailingSeparator(rootPath);
      }),
    );
  } else {
    roots = rootPaths.map(root => nuclideUri.ensureTrailingSeparator(root));
  }

  const sortedFilePaths = Array.from(fileChanges.entries()).sort(
    ([filePath1], [filePath2]) =>
      nuclideUri
        .basename(filePath1)
        .toLowerCase()
        .localeCompare(nuclideUri.basename(filePath2).toLowerCase()),
  );

  const changedRoots = new Map(
    roots.map(root => {
      const rootChanges = new Map(
        sortedFilePaths.filter(([filePath]) =>
          nuclideUri.contains(root, filePath),
        ),
      );
      return [root, rootChanges];
    }),
  );

  return changedRoots;
}

export async function confirmAndDeletePath(
  repository: ?Repository,
  nuclideFilePath: NuclideUri,
): Promise<boolean> {
  if (repository == null || repository.getType() !== 'hg') {
    return false;
  }
  const result = atom.confirm({
    message: 'Are you sure you want to delete the following item?',
    detailedMessage: `You are deleting: \n ${nuclideUri.getPath(
      nuclideFilePath,
    )}`,
    buttons: ['Delete', 'Cancel'],
  });
  invariant(result === 0 || result === 1);
  if (result === 0) {
    return deleteFile(((repository: any): HgRepositoryClient), nuclideFilePath);
  }
  return false;
}

async function deleteFile(
  repository: HgRepositoryClient,
  nuclideFilePath: string,
): Promise<boolean> {
  const fsService = getFileSystemServiceByNuclideUri(nuclideFilePath);
  try {
    await fsService.unlink(nuclideFilePath);
    await repository.remove([nuclideFilePath], true);
  } catch (error) {
    atom.notifications.addError('Failed to delete file', {
      detail: error,
    });
    return false;
  }
  return true;
}
