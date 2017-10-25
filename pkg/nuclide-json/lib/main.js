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

import type {
  CodeFormatProvider,
  HyperclickProvider,
  Outline,
  OutlineProvider,
} from 'atom-ide-ui';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import {getOutline} from './JSONOutlineProvider';
import {getNPMHyperclickProvider} from './NPMHyperclickProvider';

import CodeFormatHelpers from './CodeFormatHelpers';

class Activation {
  _disposables: UniversalDisposable;

  constructor(state: ?Object) {
    this._disposables = new UniversalDisposable();
  }

  dispose(): void {
    this._disposables.dispose();
  }
}

let activation: ?Activation = null;

export function activate(state: ?Object): void {
  if (activation == null) {
    activation = new Activation(state);
  }
}

export function deactivate(): void {
  if (activation != null) {
    activation.dispose();
    activation = null;
  }
}

export function provideOutlines(): OutlineProvider {
  return {
    grammarScopes: ['source.json'],
    priority: 1,
    name: 'Nuclide JSON',
    getOutline(editor: atom$TextEditor): Promise<?Outline> {
      return Promise.resolve(getOutline(editor.getText()));
    },
  };
}

export function getHyperclickProvider(): HyperclickProvider {
  return getNPMHyperclickProvider();
}

export function provideCodeFormat(): CodeFormatProvider {
  return {
    grammarScopes: ['source.json'],
    priority: 1,
    formatEntireFile(editor, range) {
      return CodeFormatHelpers.formatEntireFile(editor, range);
    },
  };
}
