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

import type FileTreeContextMenu from '../../nuclide-file-tree/lib/FileTreeContextMenu';
import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';

import invariant from 'assert';
import registerGrammar from '../../commons-atom/register-grammar';
import {CompositeDisposable, Disposable} from 'atom';
import {repositoryForPath} from '../../nuclide-vcs-base';
import {
  addPath,
  confirmAndRevertPath,
  revertPath,
} from '../../nuclide-vcs-base';
import HgRepositoryProvider from './HgRepositoryProvider';

const HG_ADD_TREE_CONTEXT_MENU_PRIORITY = 400;
const HG_REVERT_FILE_TREE_CONTEXT_MENU_PRIORITY = 1050;

let subscriptions: ?CompositeDisposable = null;

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
    return nodes.every(node => node.repo.isStatusUntracked(node.vcsStatusCode));
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
  subscriptions = new CompositeDisposable();

  subscriptions.add(
    atom.commands.add(
      'atom-text-editor',
      'nuclide-hg-repository:revert',
      event => {
        const editorElement: atom$TextEditorElement = (event.currentTarget: any);
        revertPath(editorElement.getModel().getPath());
      },
    ),
  );

  subscriptions.add(
    atom.commands.add(
      'atom-text-editor',
      'nuclide-hg-repository:confirm-and-revert',
      event => {
        const editorElement: atom$TextEditorElement = (event.currentTarget: any);
        confirmAndRevertPath(editorElement.getModel().getPath());
      },
    ),
  );

  subscriptions.add(
    atom.commands.add(
      'atom-text-editor',
      'nuclide-hg-repository:add',
      event => {
        const editorElement: atom$TextEditorElement = (event.currentTarget: any);
        addPath(editorElement.getModel().getPath());
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
        confirmAndRevertPath(revertNode == null ? null : revertNode.uri);
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
          addPath(addNode == null ? null : addNode.uri);
        }
      },
      shouldDisplay() {
        return shouldDisplayActionTreeItem(contextMenu, 'Add');
      },
    },
    HG_ADD_TREE_CONTEXT_MENU_PRIORITY,
  );
  subscriptions.add(addContextDisposable);

  return new Disposable(() => {
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
