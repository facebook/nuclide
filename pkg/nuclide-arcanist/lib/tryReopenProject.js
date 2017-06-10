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

import type {RemoteProjectsService} from '../../nuclide-remote-projects';

import nuclideUri from 'nuclide-commons/nuclideUri';

export default (async function tryReopenProject(
  projectId: string,
  lastPath: string,
  remoteProjectsService: ?RemoteProjectsService,
): Promise<?string> {
  const response = await new Promise(resolve => {
    const notification = atom.notifications.addInfo(
      `Project \`${projectId}\` not open`,
      {
        description: `You tried to open a file in the \`${projectId}\` project, but it doesn't ` +
          'seem to be in your open projects.<br />' +
          `You last had it open at \`${nuclideUri.nuclideUriToDisplayString(lastPath)}\`.<br />` +
          'Would you like to try re-opening it?',
        dismissable: true,
        buttons: [
          {
            className: 'icon icon-file-add',
            onDidClick: () => {
              resolve(true);
              notification.dismiss();
            },
            text: 'Open Project',
          },
          {
            onDidClick: () => {
              resolve(false);
              notification.dismiss();
            },
            text: 'Cancel',
          },
        ],
      },
    );
    const disposable = notification.onDidDismiss(() => {
      resolve(false);
      disposable.dispose();
    });
  });
  if (!response) {
    return null;
  }

  const {hostname, path} = nuclideUri.parse(lastPath);
  if (hostname == null) {
    const directoryCount = atom.project.getDirectories().length;
    atom.project.addPath(path);
    // Hacky way of checking that the project was successfully added.
    // Atom will not add the path if it doesn't exist.
    return atom.project.getDirectories().length !== directoryCount
      ? path
      : null;
  }

  if (remoteProjectsService != null) {
    const connection = await remoteProjectsService.createRemoteConnection({
      host: hostname,
      cwd: path,
      displayTitle: '',
    });
    if (connection != null) {
      return connection.getUriForInitialWorkingDirectory();
    }
  }

  return null;
});
