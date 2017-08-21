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

import type {HyperclickProvider} from './types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import createPackage from 'nuclide-commons-atom/createPackage';
import Hyperclick from './Hyperclick';

// Legacy providers have a default priority of 0.
function fixLegacyProvider(provider: HyperclickProvider) {
  if (provider.priority == null) {
    provider.priority = 0;
  }
  return provider;
}

class Activation {
  _hyperclick: Hyperclick;
  _disposables: UniversalDisposable;

  constructor() {
    this._hyperclick = new Hyperclick();
    this._disposables = new UniversalDisposable(this._hyperclick);
  }

  dispose() {
    this._disposables.dispose();
  }

  // Legacy providers have a default priority of 0.
  addLegacyProvider(
    provider: HyperclickProvider | Array<HyperclickProvider>,
  ): IDisposable {
    return this.addProvider(
      Array.isArray(provider)
        ? provider.map(fixLegacyProvider)
        : fixLegacyProvider(provider),
    );
  }

  addProvider(
    provider: HyperclickProvider | Array<HyperclickProvider>,
  ): IDisposable {
    const disposable = this._hyperclick.addProvider(provider);
    this._disposables.add(disposable);
    return disposable;
  }

  /**
   * A TextEditor whose creation is announced via atom.workspace.observeTextEditors() will be
   * observed by default by hyperclick. However, if a TextEditor is created via some other means,
   * (such as a building block for a piece of UI), then it must be observed explicitly.
   */
  observeTextEditor(): (textEditor: atom$TextEditor) => IDisposable {
    return (textEditor: atom$TextEditor) =>
      this._hyperclick.observeTextEditor(textEditor);
  }
}

createPackage(module.exports, Activation);
