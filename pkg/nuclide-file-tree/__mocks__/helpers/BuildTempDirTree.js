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

import {denodeify} from 'nuclide-commons/promise';

import tempModule from 'temp';
tempModule.track();
const tempMkDir = denodeify(tempModule.mkdir);

import {makeTree} from 'fs-plus';
const mkdir = denodeify(makeTree);

// eslint-disable-next-line nuclide-internal/no-unresolved
import touchModule from 'touch';
const touch = denodeify(touchModule);

import nuclideUri from 'nuclide-commons/nuclideUri';

export async function buildTempDirTree(
  ...paths: Array<string>
): Promise<Map<string, string>> {
  const rootPath = await tempMkDir('/');
  const fileMap = new Map();

  for (let i = 0; i < paths.length; i++) {
    const pathItem = paths[i];
    const arrPathItemParts = nuclideUri.split(pathItem);
    const itemGlobalDirPath = nuclideUri.join(
      rootPath,
      ...arrPathItemParts.slice(0, -1),
    );
    const itemLocalFileName = arrPathItemParts[arrPathItemParts.length - 1];

    // eslint-disable-next-line no-await-in-loop
    await mkdir(itemGlobalDirPath);
    if (itemLocalFileName) {
      // eslint-disable-next-line no-await-in-loop
      await touch(nuclideUri.join(itemGlobalDirPath, itemLocalFileName));
    }

    arrPathItemParts.forEach((val, j) => {
      let prefixNodePath = nuclideUri.join(
        rootPath,
        ...arrPathItemParts.slice(0, j + 1),
      );
      if (
        j < arrPathItemParts.length - 1 ||
        nuclideUri.endsWithSeparator(val)
      ) {
        prefixNodePath = nuclideUri.ensureTrailingSeparator(prefixNodePath);
      }

      fileMap.set(
        nuclideUri.join(...arrPathItemParts.slice(0, j + 1)),
        prefixNodePath,
      );
    });
  }

  return fileMap;
}
