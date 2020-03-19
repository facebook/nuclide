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

import typeof * as JediService from './JediService';

import invariant from 'assert';
import {Observable} from 'rxjs';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {getOriginalEnvironment, spawn} from 'nuclide-commons/process';
import which from 'nuclide-commons/which';
import {RpcProcess} from '../../nuclide-rpc';
import {ServiceRegistry, loadServicesConfig} from '../../nuclide-rpc';
import {localNuclideUriMarshalers} from '../../nuclide-marshalers-common';

const LIB_PATH = nuclideUri.join(__dirname, '../VendorLib');
const PROCESS_PATH = nuclideUri.join(__dirname, '../python/jediserver.py');
const OPTS = {
  cwd: nuclideUri.dirname(PROCESS_PATH),
  stdio: 'pipe',
  detached: false, // When Atom is killed, server process should be killed.
  env: {...process.env, PYTHONPATH: LIB_PATH},
  /* TODO(T17353599) */ isExitError: () => false,
};

let serviceRegistry: ?ServiceRegistry = null;

function getServiceRegistry(): ServiceRegistry {
  if (serviceRegistry == null) {
    serviceRegistry = new ServiceRegistry(
      [localNuclideUriMarshalers],
      loadServicesConfig(nuclideUri.join(__dirname, '..')),
      'python_language_service',
    );
  }
  return serviceRegistry;
}

async function getServerArgs() {
  let overrides = {};
  try {
    // Override the python path and additional sys paths
    // if override script is present.
    // $FlowFB
    const findJediServerArgs = require('./fb/find-jedi-server-args').default;
    overrides = await findJediServerArgs();
  } catch (e) {
    // Ignore.
  }

  // Append the user's PYTHONPATH if it exists.
  const {PYTHONPATH} = await getOriginalEnvironment();
  if (PYTHONPATH != null && PYTHONPATH.trim() !== '') {
    overrides.paths = (overrides.paths || []).concat(
      nuclideUri.splitPathList(PYTHONPATH),
    );
  }

  // Jedi only parses Python3 files if we start with Python3.
  // It's not the end of the world if Python3 isn't available, though.
  let pythonPath = 'python';
  if (overrides.pythonPath == null) {
    const python3Path = await which('python3');
    if (python3Path != null) {
      pythonPath = python3Path;
    }
  }

  return {
    // Default to assuming that python is in system PATH.
    pythonPath,
    paths: [],
    ...overrides,
  };
}

export default class JediServer {
  _process: RpcProcess;
  _isDisposed: boolean;

  constructor() {
    const processStream = Observable.fromPromise(getServerArgs()).switchMap(
      ({pythonPath, paths}) => {
        let args = [PROCESS_PATH];
        if (paths.length > 0) {
          args.push('-p');
          args = args.concat(paths);
        }
        return spawn(pythonPath, args, OPTS);
      },
    );
    this._process = new RpcProcess(
      'JediServer',
      getServiceRegistry(),
      processStream,
    );
    this._isDisposed = false;
  }

  getService(): Promise<JediService> {
    invariant(!this._isDisposed, 'getService called on disposed JediServer');
    return this._process.getService('JediService');
  }

  isDisposed(): boolean {
    return this._isDisposed;
  }

  dispose(): void {
    this._isDisposed = true;
    this._process.dispose();
  }
}
