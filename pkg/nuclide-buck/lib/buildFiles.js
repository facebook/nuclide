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

import type {NuclideUri} from 'nuclide-commons/nuclideUri';
import nuclideUri from 'nuclide-commons/nuclideUri';

import {getBuckProjectRoot} from '../../nuclide-buck-base';
import {getBuckServiceByNuclideUri} from '../../nuclide-remote-connection';
import getElementFilePath from '../../commons-atom/getElementFilePath';
import {getFileSystemServiceByNuclideUri} from '../../nuclide-remote-connection';
import {getLogger} from 'log4js';
import {goToLocation} from 'nuclide-commons-atom/go-to-location';

const DEFAULT_BUILD_FILE_NAME = 'BUCK';

export async function openNearestBuildFile(target: HTMLElement) {
  const path = getElementFilePath(target, true);
  if (path != null) {
    const buildFile = await findNearestBuildFile(path);
    if (buildFile != null) {
      // For bonus points, someone could add some logic to find the appropriate line:col to focus
      // upon opening the file and pass that to goToLocation().
      goToLocation(buildFile);
    }
  }
}

export async function findNearestBuildFile(
  textEditorPath: NuclideUri,
): Promise<?NuclideUri> {
  const buckRoot = await getBuckProjectRoot(textEditorPath);
  if (buckRoot != null) {
    const buildFileName = await getBuildFileName(buckRoot);
    const fsService = getFileSystemServiceByNuclideUri(textEditorPath);
    return fsService.findNearestAncestorNamed(
      buildFileName,
      nuclideUri.dirname(textEditorPath),
    );
  }
  return null;
}

const buildFileNameCache: Map<string, Promise<string>> = new Map();
export function getBuildFileName(buckRoot: string): Promise<string> {
  let buildFileName = buildFileNameCache.get(buckRoot);
  if (buildFileName != null) {
    return buildFileName;
  }
  const buckService = getBuckServiceByNuclideUri(buckRoot);
  buildFileName = buckService
    .getBuckConfig(buckRoot, 'buildfile', 'name')
    .catch(error => {
      getLogger('nuclide-buck').error(
        `Error trying to find the name of the buildfile in Buck project '${buckRoot}'`,
        error,
      );
      return null;
    })
    // flowlint-next-line sketchy-null-string:off
    .then(result => result || DEFAULT_BUILD_FILE_NAME);
  buildFileNameCache.set(buckRoot, buildFileName);
  return buildFileName;
}
