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

import type {Directory} from './FileTreeHelpers';
import type {FileTreeNode} from './FileTreeNode';
import type {HgRepositoryClient} from '../../nuclide-hg-repository-client';
import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import type {RemoteFile} from '../../nuclide-remote-connection';

import FileDialogComponent from '../components/FileDialogComponent';
import FileTreeHelpers from './FileTreeHelpers';
import FileTreeHgHelpers from './FileTreeHgHelpers';
import {FileTreeStore} from './FileTreeStore';
import * as React from 'react';
import ReactDOM from 'react-dom';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {File} from 'atom';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';
import {repositoryForPath} from '../../nuclide-vcs-base';
import Immutable from 'immutable';

let atomPanel: ?Object;
let dialogComponent: ?React.Component<any, any>;

type CopyPath = {
  old: NuclideUri,
  new: NuclideUri,
};

class FileSystemActions {
  openAddFolderDialog(onDidConfirm: (filePath: ?string) => mixed): void {
    const node = this._getSelectedContainerNode();
    if (!node) {
      return;
    }
    this._openAddDialog(
      'folder',
      node.localPath + '/',
      async (filePath: string, options: Object) => {
        // Prevent submission of a blank field from creating a directory.
        if (filePath === '') {
          return;
        }

        // TODO: check if filePath is in rootKey and if not, find the rootKey it belongs to.
        const directory = FileTreeHelpers.getDirectoryByKey(node.uri);
        if (directory == null) {
          return;
        }

        const {path} = nuclideUri.parse(filePath);
        const basename = nuclideUri.basename(path);
        const newDirectory = directory.getSubdirectory(basename);
        const created = await newDirectory.create();
        if (!created) {
          atom.notifications.addError(`'${basename}' already exists.`);
          onDidConfirm(null);
        } else {
          onDidConfirm(newDirectory.getPath());
        }
      },
    );
  }

  openAddFileDialog(onDidConfirm: (filePath: ?string) => mixed): void {
    const node = this._getSelectedContainerNode();
    if (!node) {
      return;
    }

    return this._openAddFileDialogImpl(
      node,
      node.localPath,
      node.uri,
      onDidConfirm,
    );
  }

  openAddFileDialogRelative(onDidConfirm: (filePath: ?string) => mixed): void {
    const editor = atom.workspace.getActiveTextEditor();
    const filePath = editor != null ? editor.getPath() : null;
    // flowlint-next-line sketchy-null-string:off
    if (!filePath) {
      return;
    }

    const dirPath = FileTreeHelpers.getParentKey(filePath);
    const rootNode = FileTreeStore.getInstance().getRootForPath(dirPath);

    if (rootNode) {
      const localPath = nuclideUri.isRemote(dirPath)
        ? nuclideUri.parse(dirPath).path
        : dirPath;

      return this._openAddFileDialogImpl(
        rootNode,
        FileTreeHelpers.keyToPath(localPath),
        dirPath,
        onDidConfirm,
      );
    }
  }

  _openAddFileDialogImpl(
    rootNode: FileTreeNode,
    localPath: NuclideUri,
    filePath: NuclideUri,
    onDidConfirm: (filePath: ?string) => mixed,
  ): void {
    const hgRepository = FileTreeHgHelpers.getHgRepositoryForNode(rootNode);
    const additionalOptions = {};
    if (hgRepository != null) {
      additionalOptions.addToVCS = 'Add the new file to version control.';
    }
    this._openAddDialog(
      'file',
      nuclideUri.ensureTrailingSeparator(localPath),
      async (pathToCreate: string, options: {addToVCS?: boolean}) => {
        // Prevent submission of a blank field from creating a file.
        if (pathToCreate === '') {
          return;
        }

        // TODO: check if pathToCreate is in rootKey and if not, find the rootKey it belongs to.
        const directory = FileTreeHelpers.getDirectoryByKey(filePath);
        if (directory == null) {
          return;
        }

        const newFile = directory.getFile(pathToCreate);
        const created = await newFile.create();
        if (created) {
          const newFilePath = newFile.getPath();
          // Open a new text editor while VCS actions complete in the background.
          onDidConfirm(newFilePath);
          if (hgRepository != null && options.addToVCS === true) {
            try {
              await hgRepository.addAll([newFilePath]);
            } catch (e) {
              atom.notifications.addError(
                `Failed to add '${newFilePath}' to version control. Error: ${e.toString()}`,
              );
            }
          }
        } else {
          atom.notifications.addError(`'${pathToCreate}' already exists.`);
          onDidConfirm(null);
        }
      },
      additionalOptions,
    );
  }

  _getHgRepositoryForPath(filePath: string): ?HgRepositoryClient {
    const repository = repositoryForPath(filePath);
    if (repository != null && repository.getType() === 'hg') {
      return ((repository: any): HgRepositoryClient);
    }
    return null;
  }

  async _onConfirmRename(
    node: FileTreeNode,
    nodePath: string,
    newBasename: string,
  ): Promise<void> {
    /*
     * Use `resolve` to strip trailing slashes because renaming a file to a name with a
     * trailing slash is an error.
     */
    let newPath = nuclideUri.resolve(
      // Trim leading and trailing whitespace to prevent bad filenames.
      nuclideUri.join(nuclideUri.dirname(nodePath), newBasename.trim()),
    );

    // Create a remote nuclide uri when the node being moved is remote.
    if (nuclideUri.isRemote(node.uri)) {
      newPath = nuclideUri.createRemoteUri(
        nuclideUri.getHostname(node.uri),
        newPath,
      );
    }

    await FileTreeHgHelpers.renameNode(node, newPath);
  }

  async _onConfirmDuplicate(
    file: File | RemoteFile,
    newBasename: string,
    addToVCS: boolean,
    onDidConfirm: (filePaths: Array<string>) => mixed,
  ): Promise<void> {
    const directory = file.getParent();
    const newFile = directory.getFile(newBasename);
    return this._doCopy(
      [{old: file.getPath(), new: newFile.getPath()}],
      addToVCS,
      onDidConfirm,
    );
  }

  getDirectoryFromMetadata(cbMeta: ?mixed): ?Directory {
    if (
      cbMeta == null ||
      typeof cbMeta !== 'object' ||
      cbMeta.directory == null ||
      typeof cbMeta.directory !== 'string'
    ) {
      return null;
    }
    return FileTreeHelpers.getDirectoryByKey(cbMeta.directory);
  }

  async _onConfirmPaste(
    newDirPath: string,
    addToVCS: boolean,
    onDidConfirm: (filePath: Array<string>) => mixed = () => {},
  ): Promise<void> {
    const newDir = FileTreeHelpers.getDirectoryByKey(newDirPath);
    if (newDir == null) {
      // bad target
      return;
    }

    const cb = atom.clipboard.readWithMetadata();
    const oldDir = this.getDirectoryFromMetadata(cb.metadata);
    if (oldDir == null) {
      // bad source
      return;
    }

    const copyPaths = [];
    cb.text.split(',').forEach(encodedFilename => {
      const filename = decodeURIComponent(encodedFilename);
      const oldPath = oldDir.getFile(filename).getPath();
      const newPath = newDir.getFile(filename).getPath();
      copyPaths.push({old: oldPath, new: newPath});
    });

    await this._doCopy(copyPaths, addToVCS, onDidConfirm);
  }

  async _doCopy(
    copyPaths: Array<CopyPath>,
    addToVCS: boolean,
    onDidConfirm: (filePaths: Array<string>) => mixed,
  ): Promise<void> {
    const copiedPaths = await Promise.all(
      copyPaths
        .filter(
          ({old: oldPath, new: newPath}) =>
            nuclideUri.getHostnameOpt(oldPath) ===
            nuclideUri.getHostnameOpt(newPath),
        )
        .map(async ({old: oldPath, new: newPath}) => {
          const service = getFileSystemServiceByNuclideUri(newPath);
          const isFile = (await service.stat(oldPath)).isFile();
          const exists = isFile
            ? !await service.copy(oldPath, newPath)
            : !await service.copyDir(oldPath, newPath);
          if (exists) {
            atom.notifications.addError(`'${newPath}' already exists.`);
            return [];
          } else {
            return [newPath];
          }
        }),
    );

    const successfulPaths = [].concat(...copiedPaths);
    if (successfulPaths.length !== 0) {
      const hgRepository = this._getHgRepositoryForPath(successfulPaths[0]);
      if (hgRepository != null && addToVCS) {
        try {
          // We are not recording the copy in mercurial on purpose, because most of the time
          // it's either templates or files that have greatly changed since duplicating.
          await hgRepository.addAll(successfulPaths);
        } catch (e) {
          const message =
            'Paths were duplicated, but there was an error adding them to ' +
            'version control.  Error: ' +
            e.toString();
          atom.notifications.addError(message);
          onDidConfirm([]);
          return;
        }
      }
    }

    onDidConfirm(successfulPaths);
  }

  openRenameDialog(): void {
    const store = FileTreeStore.getInstance();
    const targetNodes = store.getTargetNodes();
    if (targetNodes.size !== 1) {
      // Can only rename one entry at a time.
      return;
    }

    const node = targetNodes.first();
    const nodePath = node.localPath;
    this._openDialog({
      iconClassName: 'icon-arrow-right',
      initialValue: nuclideUri.basename(nodePath),
      message: node.isContainer
        ? <span>Enter the new path for the directory.</span>
        : <span>Enter the new path for the file.</span>,
      onConfirm: (newBasename: string, options: Object) => {
        this._onConfirmRename(node, nodePath, newBasename).catch(error => {
          atom.notifications.addError(
            `Rename to ${newBasename} failed: ${error.message}`,
          );
        });
      },
      onClose: this._closeDialog,
      selectBasename: true,
    });
  }

  openDuplicateDialog(onDidConfirm: (filePaths: Array<string>) => mixed): void {
    const store = FileTreeStore.getInstance();
    const targetNodes = store.getTargetNodes();
    this.openNextDuplicateDialog(targetNodes, onDidConfirm);
  }

  openNextDuplicateDialog(
    nodes: Immutable.List<FileTreeNode>,
    onDidConfirm: (filePaths: Array<string>) => mixed,
  ): void {
    const node = nodes.first();
    const nodePath = node.localPath;
    let initialValue = nuclideUri.basename(nodePath);
    const ext = nuclideUri.extname(nodePath);
    initialValue =
      initialValue.substr(0, initialValue.length - ext.length) + '-copy' + ext;
    const hgRepository = FileTreeHgHelpers.getHgRepositoryForNode(node);
    const additionalOptions = {};
    if (hgRepository !== null) {
      additionalOptions.addToVCS = 'Add the new file to version control.';
    }

    const dialogProps = {
      iconClassName: 'icon-arrow-right',
      initialValue,
      message: <span>Enter the new path for the duplicate.</span>,
      onConfirm: (newBasename: string, options: {addToVCS?: boolean}) => {
        const file = FileTreeHelpers.getFileByKey(node.uri);
        if (file == null) {
          // TODO: Connection could have been lost for remote file.
          return;
        }
        this._onConfirmDuplicate(
          file,
          newBasename.trim(),
          Boolean(options.addToVCS),
          onDidConfirm,
        ).catch(error => {
          atom.notifications.addError(
            `Failed to duplicate '${file.getPath()}'`,
          );
        });
      },
      onClose: () => {
        if (nodes.rest().count() > 0) {
          this.openNextDuplicateDialog(nodes.rest(), onDidConfirm);
        } else {
          this._closeDialog();
        }
      },
      selectBasename: true,
      additionalOptions,
    };
    this._openDialog(dialogProps);
  }

  openPasteDialog(): void {
    const store = FileTreeStore.getInstance();
    const node = store.getSingleSelectedNode();
    if (node == null) {
      // don't paste if unselected
      return;
    }
    let newDir = FileTreeHelpers.getDirectoryByKey(node.uri);
    if (newDir == null) {
      // maybe it's a file?
      const file = FileTreeHelpers.getFileByKey(node.uri);
      if (file == null) {
        // nope! do nothing if we can't find an entry
        return;
      }
      newDir = file.getParent();
    }

    const additionalOptions = {};
    if (FileTreeHgHelpers.getHgRepositoryForNode(node) !== null) {
      additionalOptions.addToVCS = 'Add the new file(s) to version control.';
    }
    this._openDialog({
      iconClassName: 'icon-arrow-right',
      initialValue: FileTreeHelpers.dirPathToKey(newDir.getPath()),
      message: <span>Paste file(s) from clipboard into</span>,
      onConfirm: (pasteDirPath: string, options: {addToVCS?: boolean}) => {
        this._onConfirmPaste(
          pasteDirPath.trim(),
          Boolean(options.addToVCS),
        ).catch(error => {
          atom.notifications.addError(
            `Failed to paste into '${pasteDirPath}': ${error}`,
          );
        });
      },
      onClose: this._closeDialog,
      additionalOptions,
    });
  }

  _getSelectedContainerNode(): ?FileTreeNode {
    const store = FileTreeStore.getInstance();
    /*
     * TODO: Choosing the last selected key is inexact when there is more than 1 root. The Set of
     * selected keys should be maintained as a flat list across all roots to maintain insertion
     * order.
     */
    const node = store.getSelectedNodes().first();
    if (node) {
      return node.isContainer ? node : node.parent;
    }

    return null;
  }

  _openAddDialog(
    entryType: string,
    path: string,
    onConfirm: (filePath: string, options: Object) => mixed,
    additionalOptions?: Object = {},
  ) {
    this._openDialog({
      iconClassName: 'icon-file-add',
      message: (
        <span>
          Enter the path for the new {entryType} in the root:<br />
          {path}
        </span>
      ),
      onConfirm,
      onClose: this._closeDialog,
      additionalOptions,
    });
  }

  _openDialog(props: Object): void {
    this._closeDialog();
    const dialogHostElement = document.createElement('div');
    atomPanel = atom.workspace.addModalPanel({item: dialogHostElement});
    dialogComponent = ReactDOM.render(
      <FileDialogComponent {...props} />,
      dialogHostElement,
    );
  }

  _closeDialog(): void {
    if (atomPanel != null) {
      if (dialogComponent != null) {
        ReactDOM.unmountComponentAtNode(atomPanel.getItem());
        dialogComponent = null;
      }

      atomPanel.destroy();
      atomPanel = null;
    }
  }
}

export default new FileSystemActions();
