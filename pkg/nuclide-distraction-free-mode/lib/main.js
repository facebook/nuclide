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

import {CompositeDisposable, Disposable} from 'atom';
import invariant from 'assert';
import analytics from 'nuclide-commons-atom/analytics';

import {DistractionFreeMode} from './DistractionFreeMode';
import {getBuiltinProviders} from './BuiltinProviders';

export type DistractionFreeModeProvider = {
  // Should be the unique to all providers. Recommended to be the package name. This string is not
  // user-facing.
  name: string,
  isVisible(): boolean,
  toggle(): void,
};

export type DistractionFreeModeState = {
  // Serialize the restore state via an array of provider names.
  restoreState: ?Array<string>,
};

class Activation {
  _disposables: CompositeDisposable;
  _tunnelVision: DistractionFreeMode;

  constructor(state: ?DistractionFreeModeState) {
    this._disposables = new CompositeDisposable();
    this._tunnelVision = new DistractionFreeMode(state);
    this._disposables.add(
      atom.commands.add(
        'atom-workspace',
        'nuclide-distraction-free-mode:toggle',
        () => {
          analytics.track('distraction-free-mode:toggle');
          this._tunnelVision.toggleDistractionFreeMode();
        },
      ),
    );
  }

  dispose(): void {
    this._disposables.dispose();
  }

  serialize(): DistractionFreeModeState {
    return this._tunnelVision.serialize();
  }

  consumeDistractionFreeModeProvider(
    providerOrList:
      | DistractionFreeModeProvider
      | Array<DistractionFreeModeProvider>,
  ): IDisposable {
    const providers = Array.isArray(providerOrList)
      ? providerOrList
      : [providerOrList];
    return new CompositeDisposable(
      ...providers.map(provider =>
        this._tunnelVision.consumeDistractionFreeModeProvider(provider),
      ),
    );
  }

  consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
    const toolBar = getToolBar('nuclide-distraction-free-mode');
    toolBar.addSpacer({
      priority: 900,
    });
    toolBar.addButton({
      icon: 'eye',
      callback: 'nuclide-distraction-free-mode:toggle',
      tooltip: 'Toggle Distraction-Free Mode',
      priority: 901,
    });
    const disposable = new Disposable(() => {
      toolBar.removeItems();
    });
    this._disposables.add(disposable);
    return disposable;
  }
}

let activation: ?Activation = null;

export function activate(state: ?DistractionFreeModeState) {
  if (activation == null) {
    activation = new Activation(state);
    for (const provider of getBuiltinProviders()) {
      activation.consumeDistractionFreeModeProvider(provider);
    }
  }
}

export function deactivate() {
  if (activation != null) {
    activation.dispose();
    activation = null;
  }
}

export function serialize(): DistractionFreeModeState {
  invariant(activation != null);
  return activation.serialize();
}

export function consumeDistractionFreeModeProvider(
  provider: DistractionFreeModeProvider | Array<DistractionFreeModeProvider>,
): IDisposable {
  invariant(activation != null);
  return activation.consumeDistractionFreeModeProvider(provider);
}

export function consumeToolBar(getToolBar: toolbar$GetToolbar): IDisposable {
  invariant(activation != null);
  return activation.consumeToolBar(getToolBar);
}
