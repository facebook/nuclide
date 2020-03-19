/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow
 * @format
 */

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import installTextEditorStyles from './backports/installTextEditorStyles';

class Activation {
  _disposables: UniversalDisposable;

  activate() {
    this._disposables = new UniversalDisposable(installTextEditorStyles());
  }

  dispose() {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
