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

import type {TaskRunnerServiceApi} from '../../nuclide-task-runner/lib/types';

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import TaskRunner from './TaskRunner';

class Activation {
  _disposables = new UniversalDisposable();

  consumeTaskRunnerApi(api: TaskRunnerServiceApi): IDisposable {
    const disposable = api.register(new TaskRunner());
    this._disposables.add(disposable);
    return new UniversalDisposable(() => {
      this._disposables.remove(disposable);
    });
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
