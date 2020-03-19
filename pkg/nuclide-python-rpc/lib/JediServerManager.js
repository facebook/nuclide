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

import fsPromise from 'nuclide-commons/fsPromise';
import nuclideUri from 'nuclide-commons/nuclideUri';
import JediServer from './JediServer';
import LinkTreeManager from './LinkTreeManager';

export default class JediServerManager {
  _linkTreeManager: LinkTreeManager;
  _sysPathMap: Map<string, Array<string>>;
  _server: ?JediServer;

  constructor() {
    this._linkTreeManager = new LinkTreeManager();
    this._sysPathMap = new Map();
  }

  getJediService(): Promise<JediService> {
    if (this._server == null) {
      this._server = new JediServer();
    }
    return this._server.getService();
  }

  /**
   * It's fine if the syspath changes over time.
   * We'll return partial results while we fetch the actual values.
   */
  getSysPath(src: string): Array<string> {
    const cachedSysPath = this._sysPathMap.get(src);
    if (cachedSysPath == null) {
      const sysPath = [];
      this._sysPathMap.set(src, sysPath);
      getTopLevelModulePath(src).then(result => {
        if (result != null) {
          sysPath.push(result);
        }
      });
      this._linkTreeManager.getLinkTreePaths(src).then(result => {
        sysPath.push(...result);
      });
      getCustomSysPath(src).then(result => {
        sysPath.push(...result);
      });
      return sysPath;
    }
    return cachedSysPath;
  }

  reset(): void {
    if (this._server != null) {
      this._server.dispose();
      this._server = null;
    }
    this._sysPathMap.clear();
    this._linkTreeManager = new LinkTreeManager();
  }
}

function getTopLevelModulePath(src: string): Promise<?string> {
  return fsPromise.findFurthestFile(
    '__init__.py',
    nuclideUri.dirname(src),
    true /* stopOnMissing */,
  );
}

async function getCustomSysPath(src: string): Promise<Array<string>> {
  try {
    // $FlowFB
    const fbCustomSysPath = require('./fb/custom-sys-path').default;
    return await fbCustomSysPath(src);
  } catch (err) {
    // Ignore.
  }
  return [];
}
