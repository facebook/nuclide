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
import fsPromise from 'nuclide-commons/fsPromise';
import * as BuckService from '../../nuclide-buck-rpc';

const BUCK_GEN_PATH = 'buck-out/gen';
const LINK_TREE_SUFFIXES = {
  python_binary: '#link-tree',
  python_unittest: '#binary,link-tree',
};

export default class LinkTreeManager {
  _getBuckTargetForDir(dirPath: string) {
    return `//${dirPath}:`;
  }

  _getDirForBuckTarget(target: string) {
    return target.slice(2).replace(/:/g, '/');
  }

  async _getDependencies(
    src: string,
    basePath: string,
    kind: string,
  ): Promise<Array<string>> {
    // Since we're doing string-based comparisons, resolve paths to their
    // real (symlinks followed) paths.
    const realBasePath = await fsPromise.realpath(basePath);
    const realSrcPath = await fsPromise.realpath(src);

    // TODO: Buck rdeps performance is too slow, so only search the immediate Buck file.
    // Reconsider this if things look better.
    const MAX_ITER = 1;

    let iter = 0;
    let currPath = nuclideUri.dirname(realSrcPath);

    while (nuclideUri.contains(realBasePath, currPath) && iter < MAX_ITER) {
      const relativePath = nuclideUri.relative(realBasePath, currPath);
      if (relativePath === '.' || relativePath === '') {
        break;
      }
      const searchRoot = this._getBuckTargetForDir(relativePath);
      try {
        // Not using Promise.all since we want to break as soon as one query returns
        // a non-empty result, and we don't want concurrent buck queries.
        // eslint-disable-next-line no-await-in-loop
        const results = await BuckService.query(
          basePath,
          `kind(${kind}, rdeps(${searchRoot}, owner(${src})))`,
        );
        if (results.length > 0) {
          return results;
        }
      } catch (e) {
        // Ignore - most likely because the currPath doesn't contain a
        // BUCK/TARGETS file.
      }
      currPath = nuclideUri.dirname(currPath);
      iter++;
    }

    return [];
  }

  // TODO: memoize this function
  async getLinkTreePaths(src: string): Promise<Array<string>> {
    try {
      const buckRoot = await BuckService.getRootForPath(src);
      if (buckRoot == null) {
        return [];
      }

      let kind = 'python_binary';
      let bins = await this._getDependencies(src, buckRoot, kind);
      // Attempt to find a python_unittest target if a python_binary was not found.
      if (bins.length === 0) {
        kind = 'python_unittest';
        bins = await this._getDependencies(src, buckRoot, kind);
      }

      // TODO: once we add link-tree flavor to buck, build the link tree of the
      // first binary.
      return bins.map(bin => {
        const linkTreeSuffix = LINK_TREE_SUFFIXES[kind];
        const binPath = this._getDirForBuckTarget(bin);
        return nuclideUri.join(
          buckRoot,
          BUCK_GEN_PATH,
          binPath + linkTreeSuffix,
        );
      });
    } catch (e) {
      return [];
    }
  }

  reset(src: string): void {}

  dispose() {}
}
