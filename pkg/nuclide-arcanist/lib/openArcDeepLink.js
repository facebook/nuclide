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

import type {
  DeepLinkParams,
  DeepLinkService,
} from '../../nuclide-deep-link/lib/types';
import type {RemoteProjectsService} from '../../nuclide-remote-projects';

import invariant from 'assert';
import {remote} from 'electron';
import {getLastProjectPath} from '../../nuclide-arcanist-base';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {asyncFilter} from 'nuclide-commons/promise';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';
import getMatchingProjects from './getMatchingProjects';
import tryReopenProject from './tryReopenProject';

invariant(remote != null);

function ensureArray(x: string | Array<string>): Array<string> {
  return typeof x === 'string' ? [x] : x;
}

// Check if any other open windows have the given path.
async function searchOtherWindows(
  path: string,
): Promise<?electron$BrowserWindow> {
  const windows = await Promise.all(
    remote.BrowserWindow
      .getAllWindows()
      // Atom 1.17 added GitHub's git integration, which spawns a hidden
      // browser window which we should ignore.
      .filter(browserWindow => browserWindow.isVisible())
      .map(browserWindow => {
        return new Promise((resolve, reject) => {
          // In case `atom` hasn't been initialized yet.
          browserWindow.webContents.executeJavaScript(
            'atom && atom.project.getPaths()',
            result => {
              // Guard against null returns (and also help Flow).
              const containsPath =
                Array.isArray(result) &&
                result.find(
                  project =>
                    typeof project === 'string' &&
                    nuclideUri.contains(path, project),
                );
              // flowlint-next-line sketchy-null-mixed:off
              resolve(containsPath ? browserWindow : null);
            },
          );
        });
      }),
  );
  return windows.find(Boolean);
}

export async function openArcDeepLink(
  params: DeepLinkParams,
  remoteProjectsService: ?RemoteProjectsService,
  deepLinkService: DeepLinkService,
  cwd: ?string = null,
): Promise<void> {
  const {project, path, line, column} = params;
  try {
    invariant(typeof project === 'string', 'Must provide an Arcanist project');
    invariant(
      project.match(/^[a-zA-Z0-9-_]+$/),
      'Must provide a valid Arcanist project',
    );
    invariant(path, 'Must provide a valid path');

    if (remoteProjectsService != null) {
      await new Promise(resolve =>
        remoteProjectsService.waitForRemoteProjectReload(resolve),
      );
    }

    let matches = await getMatchingProjects(project, atom.project.getPaths());
    if (matches.length === 0) {
      const lastPath = getLastProjectPath(project);
      if (lastPath != null) {
        const otherWindow = await searchOtherWindows(lastPath);
        if (otherWindow != null) {
          deepLinkService.sendDeepLink(otherWindow, 'open-arc', params);
          return;
        }
        // See if we had this project open previously, and try re-opening it.
        if (await tryReopenProject(project, lastPath, remoteProjectsService)) {
          matches = await getMatchingProjects(project, [lastPath]);
        }
      }
    }

    if (matches.length === 0) {
      throw new Error(
        `The file you are trying to open is in the \`${project}\` project ` +
          'but you do not have the project open.<br />' +
          'Please add the project manually and try again.',
      );
    }

    // Params can be strings or arrays. Always convert to an array
    const paths = ensureArray(path);
    const lines = line == null ? null : ensureArray(line);
    const columns = column == null ? null : ensureArray(column);

    // If there are multiple matches, prefer one which contains the first file.
    // Otherwise, we still want to support the case of opening a new file.
    let match = matches[0];
    if (matches.length > 1) {
      const existing = await asyncFilter(matches, async directory => {
        const fsService = getFileSystemServiceByNuclideUri(directory);
        return fsService.exists(
          nuclideUri.join(nuclideUri.getPath(directory), paths[0]),
        );
      });
      if (cwd != null && existing.includes(cwd)) {
        match = cwd;
      } else if (existing[0]) {
        match = existing[0];
      } else if (cwd != null && matches.includes(cwd)) {
        match = cwd;
      }
    }

    for (let i = 0; i < paths.length; i++) {
      const localPath = nuclideUri.join(match, paths[i]);
      const intLine = lines == null ? undefined : parseInt(lines[i], 10) - 1;
      const intColumn =
        columns == null ? undefined : parseInt(columns[i], 10) - 1;
      goToLocation(localPath, intLine, intColumn);
    }
  } catch (err) {
    atom.notifications.addError(err.message, {dismissable: true});
  }
}
