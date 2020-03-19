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

import nuclideUri from 'nuclide-commons/nuclideUri';
import {isSourceFile, getFileBasename, isHeaderFile} from '../utils';
import {searchFileWithBasename} from './common';

function getFrameworkStructureFromSourceDir(
  dir: string,
): ?{
  frameworkPath: string,
  frameworkName: string,
  frameworkSubFolder: string,
} {
  const paths = nuclideUri.split(dir).reverse();
  const rootIndex = paths.findIndex(folderName => folderName === 'Sources');
  if (rootIndex === -1) {
    return null;
  }
  const frameworkName = paths[rootIndex + 1];
  const frameworkPath = nuclideUri.join(
    ...paths.slice(rootIndex + 1).reverse(),
  );
  const frameworkSubPaths = paths.slice(0, rootIndex);
  const frameworkSubFolder =
    frameworkSubPaths.length === 0
      ? ''
      : nuclideUri.join(...frameworkSubPaths.reverse());
  return {
    frameworkPath,
    frameworkName,
    frameworkSubFolder,
  };
}

function getFrameworkStructureFromHeaderDir(
  dir: string,
): ?{
  frameworkPath: string,
  frameworkName: string,
  frameworkSubFolder: string,
} {
  const paths = nuclideUri.split(dir).reverse();
  const rootIndex = paths.findIndex(folderName =>
    ['Headers', 'PrivateHeaders'].includes(folderName),
  );
  if (rootIndex === -1) {
    return null;
  }
  const frameworkName = paths[rootIndex + 1];
  const frameworkPath = nuclideUri.join(
    ...paths.slice(rootIndex + 1).reverse(),
  );
  const frameworkSubPaths = paths.slice(0, rootIndex - 1);
  const frameworkSubFolder =
    frameworkSubPaths.length === 0
      ? ''
      : nuclideUri.join(...frameworkSubPaths.reverse());
  return {
    frameworkPath,
    frameworkName,
    frameworkSubFolder,
  };
}

export async function getRelatedHeaderForSourceFromFramework(
  src: string,
): Promise<?string> {
  const frameworkStructure = getFrameworkStructureFromSourceDir(
    nuclideUri.dirname(src),
  );
  if (frameworkStructure == null) {
    return null;
  }
  const {frameworkPath, frameworkName, frameworkSubFolder} = frameworkStructure;
  const basename = getFileBasename(src);
  const headers = await Promise.all(
    ['Headers', 'PrivateHeaders'].map(headerFolder =>
      searchFileWithBasename(
        nuclideUri.join(
          frameworkPath,
          headerFolder,
          frameworkName,
          frameworkSubFolder,
        ),
        basename,
        isHeaderFile,
      ),
    ),
  );
  return headers.find(file => file != null);
}

export async function getRelatedSourceForHeaderFromFramework(
  header: string,
): Promise<?string> {
  const frameworkStructure = getFrameworkStructureFromHeaderDir(
    nuclideUri.dirname(header),
  );
  if (frameworkStructure == null) {
    return null;
  }
  const {frameworkPath, frameworkSubFolder} = frameworkStructure;
  return searchFileWithBasename(
    nuclideUri.join(frameworkPath, 'Sources', frameworkSubFolder),
    getFileBasename(header),
    isSourceFile,
  );
}
