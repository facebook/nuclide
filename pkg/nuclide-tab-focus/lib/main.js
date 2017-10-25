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

import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {_TABBABLE_CLASS_NAME} from 'nuclide-commons-ui/TabbableContainer';

import {focusNext, focusPrevious} from './focus';

class Activation {
  _disposables: UniversalDisposable;

  constructor() {
    this._disposables = new UniversalDisposable(
      atom.commands.add(`atom-workspace .${_TABBABLE_CLASS_NAME}`, {
        'nuclide-tab-focus:focus-next': focusNext,
        'nuclide-tab-focus:focus-previous': focusPrevious,
      }),
    );
  }

  dispose() {
    this._disposables.dispose();
  }
}

createPackage(module.exports, Activation);
