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

import type {CoverageProvider} from './types';
import type {CoverageResult} from './rpc-types';
import type {ObservableDiagnosticProvider} from 'atom-ide-ui';

import React from 'react';
import ReactDOM from 'react-dom';

import {Disposable} from 'atom';

import invariant from 'assert';
import {Observable, Subject} from 'rxjs';

import analytics from 'nuclide-commons-atom/analytics';
import ActiveEditorRegistry from 'nuclide-commons-atom/ActiveEditorRegistry';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

import {StatusBarTile} from './StatusBarTile';
import {diagnosticProviderForResultStream} from './coverageDiagnostics';

const STATUS_BAR_PRIORITY = 1000;

async function resultFunction(
  provider: CoverageProvider,
  editor: atom$TextEditor,
): Promise<?CoverageResult> {
  const path = editor.getPath();
  if (path == null) {
    return null;
  }
  return provider.getCoverage(path);
}

class Activation {
  _disposables: UniversalDisposable;
  _activeEditorRegistry: ActiveEditorRegistry<
    CoverageProvider,
    ?CoverageResult,
  >;
  _toggleEvents: Subject<void>;
  _shouldRenderDiagnostics: Observable<boolean>;

  constructor(state: ?Object) {
    this._toggleEvents = new Subject();
    this._shouldRenderDiagnostics = this._toggleEvents.scan(
      prev => !prev,
      false,
    );

    this._disposables = new UniversalDisposable();
    this._activeEditorRegistry = new ActiveEditorRegistry(resultFunction, {
      updateOnEdit: false,
    });

    this._disposables.add(
      atom.commands.add(
        'atom-workspace',
        'nuclide-type-coverage:toggle-inline-display',
        () => this._toggleEvents.next(),
      ),
    );

    this._disposables.add(
      this._toggleEvents.subscribe(() =>
        analytics.track('nuclide-type-coverage:toggle'),
      ),
    );
  }

  consumeCoverageProvider(provider: CoverageProvider): IDisposable {
    return this._activeEditorRegistry.consumeProvider(provider);
  }

  consumeStatusBar(statusBar: atom$StatusBar): IDisposable {
    const item = document.createElement('div');
    item.className = 'inline-block';

    const statusBarTile = statusBar.addLeftTile({
      item,
      priority: STATUS_BAR_PRIORITY,
    });

    const resultStream = this._activeEditorRegistry.getResultsStream();
    ReactDOM.render(
      <StatusBarTile
        results={resultStream}
        isActive={this._shouldRenderDiagnostics}
        onClick={() => this._toggleEvents.next()}
      />,
      item,
    );
    const disposable = new Disposable(() => {
      ReactDOM.unmountComponentAtNode(item);
      statusBarTile.destroy();
    });
    this._disposables.add(disposable);
    return disposable;
  }

  getDiagnosticsProvider(): ObservableDiagnosticProvider {
    return diagnosticProviderForResultStream(
      this._activeEditorRegistry.getResultsStream(),
      this._shouldRenderDiagnostics,
    );
  }

  dispose() {
    this._disposables.dispose();
  }
}

let activation: ?Activation = null;

export function activate(state: ?Object) {
  if (activation == null) {
    activation = new Activation(state);
  }
}

export function deactivate() {
  if (activation != null) {
    activation.dispose();
    activation = null;
  }
}

export function consumeCoverageProvider(
  provider: CoverageProvider,
): IDisposable {
  invariant(activation != null);
  return activation.consumeCoverageProvider(provider);
}

export function consumeStatusBar(statusBar: atom$StatusBar): IDisposable {
  invariant(activation != null);
  return activation.consumeStatusBar(statusBar);
}

export function getDiagnosticsProvider(): ObservableDiagnosticProvider {
  invariant(activation != null);
  return activation.getDiagnosticsProvider();
}
