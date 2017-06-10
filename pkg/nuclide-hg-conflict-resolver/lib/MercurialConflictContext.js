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

import type {RemoteDirectory} from '../../nuclide-remote-connection';
import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import type {
  CheckoutSideName,
  MergeConflict,
} from '../../nuclide-hg-rpc/lib/HgService';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';

import nuclideUri from 'nuclide-commons/nuclideUri';
import {track} from '../../nuclide-analytics';
import invariant from 'assert';
import {Directory} from 'atom';

export class MercurialConflictContext {
  /**
   * The mercurial repository in a conflict state.
   * This would be `null` all the time except the timeframe in which one of the
   * projects' repositories
   */
  _conflictingRepository: ?HgRepositoryClient;
  _cachedMergeConflicts: Array<MergeConflict>;

  /* `merge-conflicts` API */
  // Used to join conflicting file paths (non-nullable).
  workingDirectory: atom$Directory | RemoteDirectory;
  // Used in UI buttons (hg-specific).
  resolveText: string;
  // The priority takes values: -1, 1, 2
  // -1: when there are no conflicting repository.
  //  1: when the conflicting repository isn't for the current working directory.
  //  2: when the conflicting repository is for the current working directory.
  priority: number;

  constructor() {
    this.resolveText = 'Resolve';
    this.clearConflictState();
  }

  setConflictingRepository(conflictingRepository: HgRepositoryClient): void {
    this._conflictingRepository = conflictingRepository;
    // TODO(most) Prioritize the current working directory's repository
    // in the non-typical case of multiple conflicting project repositories.
    this.priority = 2;
    this.workingDirectory = conflictingRepository._workingDirectory;
  }

  getConflictingRepository(): ?HgRepositoryClient {
    return this._conflictingRepository;
  }

  /**
   * Set the ConflictsContext to no-conflicts state.
   */
  clearConflictState(): void {
    this._cachedMergeConflicts = [];
    this._conflictingRepository = null;
    this.priority = -1;
    this.workingDirectory = new Directory('');
  }

  async readConflicts(): Promise<Array<MergeConflict>> {
    if (this._conflictingRepository == null) {
      return [];
    }
    this._cachedMergeConflicts = await this._conflictingRepository.fetchMergeConflicts();
    return this._cachedMergeConflicts.map(conflict => ({
      ...conflict,
      message: conflict.status,
    }));
  }

  async isResolvedFile(filePath: NuclideUri): Promise<boolean> {
    return (
      this._cachedMergeConflicts.findIndex(mergeConflict => {
        return mergeConflict.path === filePath;
      }) === -1
    );
  }

  async checkoutSide(
    sideName: CheckoutSideName,
    filePath: NuclideUri,
  ): Promise<void> {
    track('hg-conflict-detctor.checkout-side-requested');
    throw new Error('Checkout sides is still not working for Mercurial repos');
  }

  async resolveFile(filePath: NuclideUri): Promise<void> {
    track('hg-conflict-detctor.resolve-file');
    if (this._conflictingRepository == null) {
      throw new Error(
        "Mercurial merge conflict resolver doesn't have a conflicting repository",
      );
    }
    await this._conflictingRepository
      .markConflictedFile(filePath, /* resolved */ true)
      .toPromise();
    this._cachedMergeConflicts = this._cachedMergeConflicts.filter(
      mergeConflict => {
        return mergeConflict.path !== filePath;
      },
    );
  }

  // Deletermine if that's a rebase or merge operation.
  isRebasing(): boolean {
    // TODO(most) check rebase or merge conflict state.
    return true;
  }

  joinPath(relativePath: string): NuclideUri {
    return nuclideUri.join(this.workingDirectory.getPath(), relativePath);
  }

  complete(wasRebasing: boolean): void {
    track('hg-conflict-detctor.complete-resolving');
    invariant(wasRebasing, 'Mercurial conflict resolver only handles rebasing');
    invariant(
      this._conflictingRepository != null,
      'merge conflicts complete with no active repository!',
    );
    const repository = this._conflictingRepository;
    const notification = atom.notifications.addSuccess(
      'All Conflicts Resolved\n' +
        'Click `Continue` to run: `hg rebase --continue`',
      {
        buttons: [
          {
            onDidClick: async () => {
              notification.dismiss();
              this.clearConflictState();
              try {
                await repository
                  .continueOperation(/* operation to continue */ 'rebase')
                  .toPromise();
                atom.notifications.addInfo('Rebase continued');
              } catch (error) {
                atom.notifications.addError(
                  'Failed to continue rebase\n' +
                    'You will have to run `hg rebase --continue` manually.',
                );
              }
            },
            text: 'Continue',
          },
        ],
        dismissable: true,
      },
    );
  }

  quit(wasRebasing: boolean): void {
    track('hg-conflict-detctor.quit-resolving');
    invariant(wasRebasing, 'Mercurial conflict resolver only handles rebasing');
    invariant(
      this._conflictingRepository != null,
      'merge conflicts quit with no active repository!',
    );
    const repository = this._conflictingRepository;
    const notification = atom.notifications.addWarning(
      'Careful, You still have conflict markers!<br/>\n' +
        'Click `Abort` if you want to give up on this and run: `hg rebase --abort`.',
      {
        buttons: [
          {
            onDidClick: async () => {
              notification.dismiss();
              this.clearConflictState();
              try {
                await repository
                  .abortOperation(/* operation to abort */ 'rebase')
                  .toPromise();
                atom.notifications.addInfo('Rebase aborted');
              } catch (error) {
                atom.notifications.addError(
                  'Failed to abort rebase\n' +
                    'You will have to run `hg rebase --abort` manually.',
                );
              }
            },
            text: 'Abort',
          },
        ],
        dismissable: true,
      },
    );
  }
}
