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

import {findArcProjectIdAndDirectory} from '../../nuclide-arcanist-base';
import nuclideUri from 'nuclide-commons/nuclideUri';

export default (async function getMatchingProjects(
  projectId: string,
  projects: Array<string>,
): Promise<Array<string>> {
  // Fetch the Arcanist project of each open project.
  // This also gets parent projects, in case we have a child project mounted.
  const arcInfos = await Promise.all(
    projects.map(async dir => {
      const matches = [];
      let currentDir = dir;
      while (true) {
        // eslint-disable-next-line no-await-in-loop
        const info = await findArcProjectIdAndDirectory(currentDir);
        if (info == null) {
          break;
        }
        matches.push(info);
        currentDir = nuclideUri.dirname(info.directory);
      }
      return matches;
    }),
  );

  return []
    .concat(...arcInfos)
    .filter(Boolean)
    .filter(arcInfo => arcInfo.projectId === projectId)
    .map(arcInfo => arcInfo.directory);
});
