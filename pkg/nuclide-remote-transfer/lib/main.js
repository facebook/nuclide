/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict-local
 * @format
 */

import type FileTreeContextMenu from '../../nuclide-file-tree/lib/FileTreeContextMenu';

import {arrayCompact} from 'nuclide-commons/collection';
import createPackage from 'nuclide-commons-atom/createPackage';
import {remote} from 'electron';
import fs from 'fs';
import fsPromise from 'nuclide-commons/fsPromise';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';
import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {track} from 'nuclide-analytics';
import {writeToStream} from 'nuclide-commons/stream';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

export type RemoteTransferService = {
  uploadFiles: (
    localFiles: Array<string>,
    remoteDirectory: string,
  ) => Promise<mixed>,
};

const REMOTE_TRANSFER_FILE_TREE_CONTEXT_MENU_PRIORITY = 500;

invariant(remote != null);

function trackTransfer(
  uploadOrDownload: string,
  outcome: string,
  numFiles: number,
  fileSize: number,
  durationMs?: number,
): void {
  track('fb-nuclide-remote-transfer:' + uploadOrDownload + ':' + outcome, {
    numFiles,
    fileSize,
    ...(durationMs != null ? {durationMs} : {}),
  });
}

function shortenedEnglishListJoin(items: Array<string>): string {
  if (items.length > 3) {
    return (
      items.slice(0, 3).join(', ') + ' and ' + (items.length - 3) + ' more'
    );
  } else if (items.length > 1) {
    return items.slice(0, -1).join(', ') + ' and ' + items[items.length - 1];
  } else {
    return items[0] || '';
  }
}

function getDestinationPath(
  destinationDirectory: string,
  sourceFile: string,
): string {
  return nuclideUri.join(destinationDirectory, nuclideUri.basename(sourceFile));
}

async function sumLocalFileSizes(localFiles: Array<string>): Promise<number> {
  const sizes = await Promise.all(
    localFiles.map(async localFile => {
      const stat = await fsPromise.stat(localFile);
      return stat.size;
    }),
  );
  return sizes.reduce((a, b) => a + b);
}

async function sumRemoteFileSizes(remoteFiles: Array<string>): Promise<number> {
  const sizes = await Promise.all(
    remoteFiles.map(async remoteFile => {
      const fsService = getFileSystemServiceByNuclideUri(remoteFile);
      const stat = await fsService.stat(remoteFile);
      return stat.size;
    }),
  );
  return sizes.reduce((a, b) => a + b);
}

async function uploadFile(
  localFile: string,
  remoteDirectory: string,
): Promise<void> {
  const fsService = getFileSystemServiceByNuclideUri(remoteDirectory);
  const [buffer, stat] = await Promise.all([
    fsPromise.readFile(localFile),
    fsPromise.stat(localFile),
  ]);
  await fsService.writeFileBuffer(
    getDestinationPath(remoteDirectory, localFile),
    buffer,
    {mode: stat.mode},
  );
}

async function downloadFile(
  remoteFile: string,
  localDirectory: string,
): Promise<void> {
  const fsService = getFileSystemServiceByNuclideUri(remoteFile);
  const stat = await fsService.stat(remoteFile);
  await writeToStream(
    fsService.createReadStream(remoteFile).refCount(),
    fs.createWriteStream(getDestinationPath(localDirectory, remoteFile), {
      mode: stat.mode,
    }),
  ).toPromise();
}

async function uploadFiles(
  localFiles: Array<string>,
  remoteDirectory: string,
): Promise<void> {
  for (const localFile of localFiles) {
    // eslint-disable-next-line no-await-in-loop
    await uploadFile(localFile, remoteDirectory);
  }
}

async function downloadFiles(
  remoteFiles: Array<string>,
  localDirectory: string,
): Promise<void> {
  for (const remoteFile of remoteFiles) {
    // eslint-disable-next-line no-await-in-loop
    await downloadFile(remoteFile, localDirectory);
  }
}

function getUploadDirectoryFromContextMenuSelection(
  contextMenu: FileTreeContextMenu,
): ?string {
  const node = contextMenu.getSingleSelectedNode();
  if (
    node != null &&
    node.uri &&
    nuclideUri.isRemote(node.uri) &&
    node.isContainer
  ) {
    return node.uri;
  }
  return null;
}

function getDownloadFilesFromContextMenuSelection(
  contextMenu: FileTreeContextMenu,
): ?Array<string> {
  const selectedNodes = contextMenu.getSelectedNodes();
  const validNodes = contextMenu
    .getSelectedNodes()
    .filter(
      node =>
        node != null &&
        node.uri &&
        nuclideUri.isRemote(node.uri) &&
        !node.isContainer,
    );
  if (
    validNodes.count() === 0 ||
    validNodes.count() !== selectedNodes.count()
  ) {
    return null;
  }
  return validNodes.map(node => node.uri).toArray();
}

function confirmNotification(
  message: string,
  detail: ?string = null,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const notification = atom.notifications.addError(message, {
      ...(detail != null ? {detail} : {}),
      buttons: [
        {
          text: 'Cancel',
          onDidClick: () => {
            reject(new Error('Canceled'));
            notification.dismiss();
          },
        },
        {
          text: 'Confirm',
          onDidClick: () => {
            resolve();
            notification.dismiss();
          },
        },
      ],
      dismissable: true,
    });
    notification.onDidDismiss(() => reject(new Error('Canceled')));
  });
}

async function confirmIfUploadWouldOverwrite(
  remotePaths: Array<string>,
): Promise<void> {
  const results = await Promise.all(
    remotePaths.map(async remotePath => {
      const fsService = getFileSystemServiceByNuclideUri(remotePath);
      if (await fsService.exists(remotePath)) {
        return remotePath;
      }
      return null;
    }),
  );
  const overwritten = arrayCompact(results);
  if (overwritten.length > 1) {
    await confirmNotification(
      'This upload will overwrite ' +
        overwritten.length +
        ' files. Do you wish to continue?',
      shortenedEnglishListJoin(
        overwritten.map(path => nuclideUri.basename(path)),
      ),
    );
  } else if (overwritten.length === 1) {
    await confirmNotification(
      'This upload will overwrite ' +
        nuclideUri.basename(overwritten[0]) +
        '. Do you wish to continue?',
    );
  }
}

async function confirmIfDownloadWouldOverwrite(
  localPaths: Array<string>,
): Promise<void> {
  const results = await Promise.all(
    localPaths.map(async localPath => {
      if (await fsPromise.exists(localPath)) {
        return localPath;
      }
      return null;
    }),
  );
  const overwritten = arrayCompact(results);
  if (overwritten.length > 1) {
    await confirmNotification(
      'This download will overwrite ' +
        overwritten.length +
        ' files. Do you wish to continue?',
      shortenedEnglishListJoin(
        overwritten.map(path => nuclideUri.basename(path)),
      ),
    );
  } else if (overwritten.length === 1) {
    await confirmNotification(
      'This download will overwrite ' +
        nuclideUri.basename(overwritten[0]) +
        '. Do you wish to continue?',
    );
  }
}

function delayedWarning(
  message: string,
  msDelay: number = 1000,
  options?: atom$NotificationOptions,
): IDisposable {
  const disposables = new UniversalDisposable();
  const timeout = setTimeout(() => {
    const notification = atom.notifications.addWarning(message, options);
    disposables.add(() => notification.dismiss());
  }, msDelay);
  disposables.add(() => clearTimeout(timeout));
  return disposables;
}

async function uploadFilesWithNotifications(
  localFiles: Array<string>,
  remoteDirectory: string,
): Promise<void> {
  const sizePromise = sumLocalFileSizes(localFiles);
  try {
    await confirmIfUploadWouldOverwrite(
      localFiles.map(localFile =>
        getDestinationPath(remoteDirectory, localFile),
      ),
    );
  } catch (e) {
    trackTransfer(
      'upload',
      'overwrite-cancel',
      localFiles.length,
      await sizePromise,
    );
    return;
  }
  const fileOrFiles = localFiles.length !== 1 ? 'files' : 'file';
  const isOrAre = localFiles.length !== 1 ? 'are' : 'is';
  const disposable = delayedWarning(
    'Your ' + fileOrFiles + ' ' + isOrAre + ' still uploading...',
    3000,
    {dismissable: true},
  );
  const startTime = Date.now();
  try {
    await uploadFiles(localFiles, remoteDirectory);
    disposable.dispose();
    atom.notifications.addSuccess('Successfully uploaded ' + fileOrFiles);
    const durationMs = Date.now() - startTime;
    trackTransfer(
      'upload',
      'success',
      localFiles.length,
      await sizePromise,
      durationMs,
    );
  } catch (e) {
    disposable.dispose();
    atom.notifications.addError('Failed to upload ' + fileOrFiles, {
      detail: String(e),
      dismissable: true,
    });
    const durationMs = Date.now() - startTime;
    trackTransfer(
      'upload',
      'failure',
      localFiles.length,
      await sizePromise,
      durationMs,
    );
  }
}

async function downloadFilesWithNotifications(
  remoteFiles: Array<string>,
  localDirectory: string,
): Promise<void> {
  const sizePromise = sumRemoteFileSizes(remoteFiles);
  try {
    await confirmIfDownloadWouldOverwrite(
      remoteFiles.map(remoteFile =>
        getDestinationPath(localDirectory, remoteFile),
      ),
    );
  } catch (e) {
    trackTransfer(
      'download',
      'overwrite-cancel',
      remoteFiles.length,
      await sizePromise,
    );
    return;
  }
  const fileOrFiles = remoteFiles.length !== 1 ? 'files' : 'file';
  const isOrAre = remoteFiles.length !== 1 ? 'are' : 'is';
  const disposable = delayedWarning(
    'Your ' + fileOrFiles + ' ' + isOrAre + ' still downloading...',
    3000,
    {dismissable: true},
  );
  const startTime = Date.now();
  try {
    await downloadFiles(remoteFiles, localDirectory);
    disposable.dispose();
    atom.notifications.addSuccess('Successfully downloaded ' + fileOrFiles);
    const durationMs = Date.now() - startTime;
    trackTransfer(
      'download',
      'success',
      remoteFiles.length,
      await sizePromise,
      durationMs,
    );
  } catch (e) {
    disposable.dispose();
    atom.notifications.addError('Failed to download ' + fileOrFiles, {
      detail: String(e),
      dismissable: true,
    });
    const durationMs = Date.now() - startTime;
    trackTransfer(
      'download',
      'failure',
      remoteFiles.length,
      await sizePromise,
      durationMs,
    );
  }
}

class Activation {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable();
  }

  provideService(): RemoteTransferService {
    return {
      uploadFiles: uploadFilesWithNotifications,
    };
  }

  consumeFileTreeContextMenu(contextMenu: FileTreeContextMenu): IDisposable {
    const uploadDisposable = contextMenu.addItemToModifyFileMenu(
      {
        callback: () => {
          const nodeUri = getUploadDirectoryFromContextMenuSelection(
            contextMenu,
          );
          if (nodeUri == null) {
            return;
          }
          const info = 'Pick a file or multiple files to upload';
          remote.dialog.showOpenDialog(
            remote.getCurrentWindow(),
            {
              properties: ['openFile', 'multiSelections'],
              title: info,
              message: info,
            },
            filePaths => {
              uploadFilesWithNotifications(filePaths, nodeUri);
            },
          );
        },
        label: 'Upload File(s)',
        shouldDisplay(): boolean {
          return (
            getUploadDirectoryFromContextMenuSelection(contextMenu) != null
          );
        },
      },
      REMOTE_TRANSFER_FILE_TREE_CONTEXT_MENU_PRIORITY,
    );

    const downloadDisposable = contextMenu.addItemToModifyFileMenu(
      {
        callback: () => {
          const nodeUris = getDownloadFilesFromContextMenuSelection(
            contextMenu,
          );
          if (nodeUris == null) {
            return;
          }
          const thisFileOrTheseFiles =
            nodeUris.length !== 1 ? 'these files' : 'this file';
          const info =
            'Pick a destination to download ' + thisFileOrTheseFiles + ' to';
          remote.dialog.showOpenDialog(
            remote.getCurrentWindow(),
            {
              properties: ['openDirectory'],
              title: info,
              message: info,
            },
            filePaths => {
              // Despite Electron's documented return type, filePaths can be
              // undefined. Specifically, when the user clicks "cancel" in the
              // file selection dialog on MacOS.
              if (filePaths == null) {
                return;
              }
              downloadFilesWithNotifications(nodeUris, filePaths[0]);
            },
          );
        },
        label: 'Download File(s)',
        shouldDisplay(): boolean {
          return getDownloadFilesFromContextMenuSelection(contextMenu) != null;
        },
      },
      REMOTE_TRANSFER_FILE_TREE_CONTEXT_MENU_PRIORITY,
    );

    this._disposables.add(uploadDisposable, downloadDisposable);
    return new UniversalDisposable(
      () => this._disposables.remove(uploadDisposable),
      () => this._disposables.remove(downloadDisposable),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
