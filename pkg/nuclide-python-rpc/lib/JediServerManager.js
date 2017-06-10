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

import typeof * as JediService from './JediService';

import LRUCache from 'lru-cache';
import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getOriginalEnvironment} from 'nuclide-commons/process';
import JediServer from './JediServer';
import LinkTreeManager from './LinkTreeManager';

async function getServerArgs(src: string) {
  let overrides = {};
  try {
    // Override the python path and additional sys paths
    // if override script is present.
    // $FlowFB
    const findJediServerArgs = require('./fb/find-jedi-server-args').default;
    overrides = await findJediServerArgs(src);
  } catch (e) {
    // Ignore.
  }

  // Append the user's PYTHONPATH if it exists.
  const {PYTHONPATH} = await getOriginalEnvironment();
  if (PYTHONPATH != null && PYTHONPATH.trim() !== '') {
    overrides.paths = (overrides.paths || [])
      .concat(nuclideUri.splitPathList(PYTHONPATH));
  }

  return {
    // Default to assuming that python is in system PATH.
    pythonPath: 'python',
    paths: [],
    ...overrides,
  };
}

export default class JediServerManager {
  // Cache the promises of additional paths to ensure that we never trigger two
  // calls for the same file name from external calls to getLinkTreePaths and
  // getTopLevelModulePath.
  _cachedTopLevelModulePaths: Map<string, Promise<?string>>;
  _cachedLinkTreePaths: Map<string, Promise<Array<string>>>;

  _linkTreeManager: LinkTreeManager;
  _servers: LRUCache<string, JediServer>;

  constructor() {
    this._cachedTopLevelModulePaths = new Map();
    this._cachedLinkTreePaths = new Map();

    this._linkTreeManager = new LinkTreeManager();
    this._servers = new LRUCache({
      max: 20,
      dispose(key: string, val: JediServer) {
        val.dispose();
      },
    });
  }

  async getJediService(src: string): Promise<JediService> {
    let server = this._servers.get(src);
    if (server == null) {
      const {pythonPath, paths} = await getServerArgs(src);
      // Create a JediServer using default python path.
      server = new JediServer(src, pythonPath, paths);
      this._servers.set(src, server);

      // Add link tree and top-level module paths without awaiting,
      // so we don't block the service from returning.
      this._addLinkTreePaths(src, server);
      this._addTopLevelModulePath(src, server);
    }

    return server.getService();
  }

  getLinkTreePaths(src: string): Promise<Array<string>> {
    let linkTreePathsPromise = this._cachedLinkTreePaths.get(src);
    if (linkTreePathsPromise == null) {
      linkTreePathsPromise = this._linkTreeManager.getLinkTreePaths(src);
      this._cachedLinkTreePaths.set(src, linkTreePathsPromise);
    }

    return Promise.resolve(linkTreePathsPromise);
  }

  getTopLevelModulePath(src: string): Promise<?string> {
    let topLevelModulePathPromise = this._cachedTopLevelModulePaths.get(src);
    // We don't need to explicitly check undefined since the cached promise
    // itself is not nullable, though its content is.
    if (topLevelModulePathPromise == null) {
      // Find the furthest directory while an __init__.py is present, stopping
      // search once a directory does not contain an __init__.py.
      topLevelModulePathPromise = fsPromise.findFurthestFile(
        '__init__.py',
        nuclideUri.dirname(src),
        true /* stopOnMissing */,
      );
      this._cachedTopLevelModulePaths.set(src, topLevelModulePathPromise);
    }

    return Promise.resolve(topLevelModulePathPromise);
  }

  async _addLinkTreePaths(src: string, server: JediServer): Promise<void> {
    const linkTreePaths = await this.getLinkTreePaths(src);
    if (server.isDisposed() || linkTreePaths.length === 0) {
      return;
    }
    const service = await server.getService();
    await service.add_paths(linkTreePaths);
  }

  async _addTopLevelModulePath(src: string, server: JediServer): Promise<void> {
    const topLevelModulePath = await this.getTopLevelModulePath(src);
    if (server.isDisposed() || !topLevelModulePath) {
      return;
    }
    const service = await server.getService();
    // Add the parent dir of the top level module path, i.e. the closest
    // directory that does NOT contain __init__.py.
    await service.add_paths([nuclideUri.dirname(topLevelModulePath)]);
  }

  reset(src: string): void {
    this._servers.del(src);
    this._linkTreeManager.reset(src);
  }

  dispose(): void {
    this._servers.reset();
    this._linkTreeManager.dispose();
  }
}
