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

import type {TaskRunnerServiceApi} from '../../nuclide-task-runner/lib/types';

import {CompositeDisposable} from 'atom';
import createPackage from 'nuclide-commons-atom/createPackage';

import HhvmBuildSystem from './HhvmBuildSystem';

class Activation {
  _buildSystem: ?HhvmBuildSystem;
  _disposables: CompositeDisposable;

  constructor(state: ?Object) {
    this._disposables = new CompositeDisposable();
  }

  dispose() {
    this._disposables.dispose();
  }

  consumeTaskRunnerServiceApi(api: TaskRunnerServiceApi): void {
    this._disposables.add(api.register(this._getBuildSystem()));
  }

  _getBuildSystem(): HhvmBuildSystem {
    if (this._buildSystem == null) {
      const buildSystem = new HhvmBuildSystem();
      this._disposables.add(buildSystem);
      this._buildSystem = buildSystem;
    }
    return this._buildSystem;
  }
}

createPackage(module.exports, Activation);
