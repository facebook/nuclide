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

import invariant from 'assert';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {spawn} from 'nuclide-commons/process';
import {RpcProcess} from '../../nuclide-rpc';
import {ServiceRegistry, loadServicesConfig} from '../../nuclide-rpc';
import {localNuclideUriMarshalers} from '../../nuclide-marshalers-common';

const PYTHON_EXECUTABLE = 'python';
const LIB_PATH = nuclideUri.join(__dirname, '../VendorLib');
const PROCESS_PATH = nuclideUri.join(__dirname, '../python/jediserver.py');
const OPTS = {
  cwd: nuclideUri.dirname(PROCESS_PATH),
  stdio: 'pipe',
  detached: false, // When Atom is killed, server process should be killed.
  env: {PYTHONPATH: LIB_PATH},
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

export default class JediServer {
  _process: RpcProcess;
  _isDisposed: boolean;

  constructor(
    src: string,
    pythonPath: string = PYTHON_EXECUTABLE,
    paths?: Array<string> = [],
  ) {
    // Generate a name for this server using the src file name, used to namespace logs
    const name = `JediServer-${nuclideUri.basename(src)}`;
    let args = [PROCESS_PATH, '-s', src];
    if (paths.length > 0) {
      args.push('-p');
      args = args.concat(paths);
    }
    const processStream = spawn(pythonPath, args, OPTS);
    this._process = new RpcProcess(name, getServiceRegistry(), processStream);
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
