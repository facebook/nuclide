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

import invariant from 'assert';
import {memoize} from 'lodash';
import {getLogger} from 'log4js';
import {objectEntries, objectValues} from 'nuclide-commons/collection';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {trackTiming} from 'nuclide-analytics';
import * as BuckService from '../../nuclide-buck-rpc';

const BUCK_GEN_PATH = 'buck-out/gen';
const FILENAME_BLACKLIST = [
  // These are treated as Python files but obviously they don't have linktrees.
  'BUCK',
  'TARGETS',
];
const LINK_TREE_SUFFIXES = Object.freeze({
  python_binary: '#link-tree',
  python_test: '#binary,link-tree',
});

const logger = getLogger('LinkTreeManager');

export default class LinkTreeManager {
  getBuckRoot = memoize(
    (src: string): Promise<?string> => {
      return BuckService.getRootForPath(src);
    },
  );

  getOwner = memoize(
    async (src: string): Promise<?string> => {
      const buckRoot = await this.getBuckRoot(src);
      if (buckRoot == null) {
        return null;
      }
      const owners = await BuckService.getOwners(buckRoot, src, []).catch(
        err => {
          logger.error(`Failed to get Buck owner for ${src}`, err);
          return [];
        },
      );
      return owners.length > 0 ? owners[0] : null;
    },
  );

  /**
   * For a given file, attempts to find python_binary/python_unittest dependents.
   * Returns a mapping of target -> target type.
   */
  getDependents = memoize(async (buckRoot: string, target: string): Promise<
    Map<string, string>,
  > => {
    try {
      /**
       * Buck 'rdeps' has a pretty slow implementation:
       * it crawls all transitive deps of the first argument looking for the second.
       * Without a more efficient solution we'll just crawl the surrounding targets.
       * e.g. the universe for //a:b will just be //a/...
       */
      const targetDir = target.substr(0, target.indexOf(':'));
      const universe = targetDir + '/...';
      // Quote kinds - the kind() operator takes a string.
      const kinds = JSON.stringify(Object.keys(LINK_TREE_SUFFIXES).join('|'));
      const dependents = await BuckService.queryWithAttributes(
        buckRoot,
        `kind(${kinds}, rdeps(${universe}, ${target}))`,
        ['buck.type', 'deps'],
      );
      // Python binaries/unit tests often come with many 'helper targets'.
      // (e.g. a binary might have a version built for ipython use).
      // We'll restrict ourselves to only using the top level targets.
      const nonToplevel = new Set();
      objectValues(dependents).forEach(attrs => {
        if (Array.isArray(attrs.deps)) {
          attrs.deps.forEach(dep => {
            if (typeof dep !== 'string') {
              return;
            }
            // Resolve relative dependencies, e.g. :dep
            const resolvedDep = dep.startsWith(':') ? targetDir + dep : dep;
            nonToplevel.add(resolvedDep);
          });
        }
      });
      return new Map(
        objectEntries(dependents)
          .filter(([dep]) => !nonToplevel.has(dep))
          .map(([dep, attrs]) => {
            const buckType = String(attrs['buck.type']);
            invariant(
              LINK_TREE_SUFFIXES.hasOwnProperty(buckType),
              'got invalid buck.type',
            );
            return [dep, buckType];
          }),
      );
    } catch (err) {
      logger.error(`Failed to get dependents of target ${target}`, err);
      return new Map();
    }
  }, (buckRoot, target) => `${buckRoot}/${target}`);

  getLinkTreePaths = memoize(
    async (src: string): Promise<Array<string>> => {
      const basename = nuclideUri.basename(src);
      if (FILENAME_BLACKLIST.includes(basename)) {
        return [];
      }

      const buckRoot = await this.getBuckRoot(src);
      if (buckRoot == null) {
        return [];
      }

      return trackTiming(
        'python.link-tree',
        async () => {
          const owner = await this.getOwner(src);
          if (owner == null) {
            return [];
          }
          const dependents = await this.getDependents(buckRoot, owner);
          const paths = Array.from(dependents).map(([target, kind]) => {
            const linkTreeSuffix = LINK_TREE_SUFFIXES[kind];
            // Turn //test/target:a into test/target/a.
            const binPath = target.substr(2).replace(':', '/');
            return nuclideUri.join(
              buckRoot,
              BUCK_GEN_PATH,
              binPath + linkTreeSuffix,
            );
          });
          logger.info(`Resolved link trees for ${src}`, paths);
          return paths;
        },
        {src},
      );
    },
  );
}
