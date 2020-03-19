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

import type {DeadlineRequest} from 'nuclide-commons/promise';
import type FileTreeContextMenu from '../../nuclide-file-tree/lib/FileTreeContextMenu';
import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import type {
  AdditionalLogFile,
  AdditionalLogFilesProvider,
} from '../../nuclide-logging/lib/rpc-types';

import invariant from 'assert';
import {
  arrayCompact,
  mapTransform,
  collect,
  arrayFlatten,
} from 'nuclide-commons/collection';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import registerGrammar from '../../commons-atom/register-grammar';
import {repositoryForPath} from '../../nuclide-vcs-base';
import {addPath, confirmAndRevertPath} from '../../nuclide-vcs-base';
import HgRepositoryProvider from './HgRepositoryProvider';

const HG_ADD_TREE_CONTEXT_MENU_PRIORITY = 400;
const HG_REVERT_FILE_TREE_CONTEXT_MENU_PRIORITY = 1050;

let subscriptions: ?UniversalDisposable = null;

type HgContenxtMenuAction = 'Revert' | 'Add';

// A file is revertable if it's changed or added.
// A file is addable if it's untracked.
// A directory is revertable if it contains changed files.
function shouldDisplayActionTreeItem(
  contextMenu: FileTreeContextMenu,
  action: HgContenxtMenuAction,
): boolean {
  if (action === 'Revert') {
    const node = contextMenu.getSingleSelectedNode();
    if (node == null || node.repo == null || node.repo.getType() !== 'hg') {
      return false;
    } else {
      const hgRepository: HgRepositoryClient = (node.repo: any);
      return (
        hgRepository.isStatusModified(node.vcsStatusCode) ||
        hgRepository.isStatusAdded(node.vcsStatusCode)
      );
    }
  } else if (action === 'Add') {
    const nodes = contextMenu.getSelectedNodes();
    return nodes.every(node => {
      if (
        node.repo == null ||
        node.repo.getType() !== 'hg' ||
        // $FlowFixMe(>=0.68.0) Flow suppress (T27187857)
        typeof node.repo.isStatusUntracked !== 'function'
      ) {
        return false;
      }
      return node.repo.isStatusUntracked(node.vcsStatusCode);
    });
  } else {
    return false;
  }
}

function getActivePathAndHgRepository(): ?{
  activePath: string,
  repository: HgRepositoryClient,
} {
  const editor = atom.workspace.getActiveTextEditor();
  if (editor == null || !editor.getPath()) {
    return null;
  }
  const filePath = editor.getPath() || '';
  const repository = repositoryForPath(filePath);
  if (repository == null || repository.getType() !== 'hg') {
    return null;
  }
  const hgRepository: HgRepositoryClient = (repository: any);
  return {
    repository: hgRepository,
    activePath: filePath,
  };
}

function isActivePathRevertable(): boolean {
  const activeRepositoryInfo = getActivePathAndHgRepository();
  if (activeRepositoryInfo == null) {
    return false;
  }
  const {repository, activePath} = activeRepositoryInfo;
  return repository.isPathModified(activePath);
}

function isActivePathAddable(): boolean {
  const activeRepositoryInfo = getActivePathAndHgRepository();
  if (activeRepositoryInfo == null) {
    return false;
  }
  const {repository, activePath} = activeRepositoryInfo;
  return repository.isPathUntracked(activePath);
}

export function activate(state: any): void {
  subscriptions = new UniversalDisposable();

  subscriptions.add(
    atom.commands.add(
      'atom-text-editor',
      'nuclide-hg-repository:confirm-and-revert',
      event => {
        const editorElement: atom$TextEditorElement = (event.currentTarget: any);
        const path = editorElement.getModel().getPath();
        const repository = path == null ? null : repositoryForPath(path);
        confirmAndRevertPath(repository, path);
      },
    ),
  );

  subscriptions.add(
    atom.commands.add(
      'atom-text-editor',
      'nuclide-hg-repository:add',
      event => {
        const editorElement: atom$TextEditorElement = (event.currentTarget: any);
        const path = editorElement.getModel().getPath();
        const repository = path == null ? null : repositoryForPath(path);
        addPath(repository, path);
      },
    ),
  );

  // Text editor context menu items.
  subscriptions.add(
    atom.contextMenu.add({
      'atom-text-editor': [
        {type: 'separator'},
        {
          label: 'Source Control',
          submenu: [
            {
              label: 'Revert',
              command: 'nuclide-hg-repository:confirm-and-revert',
              shouldDisplay() {
                return isActivePathRevertable();
              },
            },
            {
              label: 'Add to Mercurial',
              command: 'nuclide-hg-repository:add',
              shouldDisplay() {
                return isActivePathAddable();
              },
            },
          ],
          shouldDisplay() {
            return getActivePathAndHgRepository() != null;
          },
        },
        {type: 'separator'},
      ],
    }),
  );

  registerGrammar('source.ini', ['.hgrc']);
}

export function addItemsToFileTreeContextMenu(
  contextMenu: FileTreeContextMenu,
): IDisposable {
  invariant(subscriptions);

  const revertContextDisposable = contextMenu.addItemToSourceControlMenu(
    {
      label: 'Revert',
      callback() {
        // TODO(most): support reverting multiple nodes at once.
        const revertNode = contextMenu.getSingleSelectedNode();
        const path = revertNode == null ? null : revertNode.uri;
        const repository = path == null ? null : repositoryForPath(path);
        confirmAndRevertPath(repository, path);
      },
      shouldDisplay() {
        return shouldDisplayActionTreeItem(contextMenu, 'Revert');
      },
    },
    HG_REVERT_FILE_TREE_CONTEXT_MENU_PRIORITY,
  );
  subscriptions.add(revertContextDisposable);

  const addContextDisposable = contextMenu.addItemToSourceControlMenu(
    {
      label: 'Add to Mercurial',
      callback() {
        const nodes = contextMenu.getSelectedNodes();
        for (const addNode of nodes) {
          const path = addNode == null ? addNode : addNode.uri;
          const repository = path == null ? null : repositoryForPath(path);
          addPath(repository, path);
        }
      },
      shouldDisplay() {
        return shouldDisplayActionTreeItem(contextMenu, 'Add');
      },
    },
    HG_ADD_TREE_CONTEXT_MENU_PRIORITY,
  );
  subscriptions.add(addContextDisposable);

  return new UniversalDisposable(() => {
    if (subscriptions != null) {
      subscriptions.remove(revertContextDisposable);
      subscriptions.remove(addContextDisposable);
    }
  });
}

export function deactivate(state: any): void {
  if (subscriptions != null) {
    subscriptions.dispose();
    subscriptions = null;
  }
}

export function createHgRepositoryProvider() {
  return new HgRepositoryProvider();
}

async function getAllHgAdditionalLogFiles(
  deadline: DeadlineRequest,
): Promise<Array<AdditionalLogFile>> {
  // Atom provides one repository object per project.
  const repositories: Array<?atom$Repository> = atom.project.getRepositories();
  // We want to avoid duplication in the case where two different projects both
  // are served by the same repository path.
  // Start by transforming into an array of [path, HgRepositoryClient] pairs.
  const hgRepositories: Array<[string, HgRepositoryClient]> = arrayCompact(
    repositories.map(
      r =>
        r != null && r.getType() === 'hg'
          ? [r.getWorkingDirectory(), ((r: any): HgRepositoryClient)]
          : null,
    ),
  );
  // For each repository path, arbitrarily pick just the first of the
  // HgRepositoryClients that serves that path.
  const uniqueRepositories: Array<HgRepositoryClient> = Array.from(
    mapTransform(
      collect(hgRepositories),
      (clients, dir) => clients[0],
    ).values(),
  );

  const results: Array<Array<AdditionalLogFile>> = await Promise.all(
    uniqueRepositories.map(r => r.getAdditionalLogFiles(deadline)),
  );
  return arrayFlatten(results);
}

export function createHgAdditionalLogFilesProvider(): AdditionalLogFilesProvider {
  return {
    id: 'hg',
    getAdditionalLogFiles: getAllHgAdditionalLogFiles,
  };
}
