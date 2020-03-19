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

import type {LanguageStatusProvider, StatusKind} from './types';

import featureConfig from 'nuclide-commons-atom/feature-config';
import nullthrows from 'nullthrows';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import {bindObservableAsProps} from 'nuclide-commons-ui/bindObservableAsProps';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable, BehaviorSubject} from 'rxjs';
import {track} from 'nuclide-analytics';
import StatusComponent from './StatusComponent';

import * as React from 'react';
import ReactDOM from 'react-dom';

const FEATURE_CONFIG_SETTINGS = 'nuclide-language-status.settings';
const DEFAULT_SETTINGS_KIND: StatusKind = 'yellow';

export class LanguageStatusManager {
  _providerRegistry: ProviderRegistry<LanguageStatusProvider>;
  _providersChanged: BehaviorSubject<void>;
  _settings: Map<string, StatusKind>;
  _statusComponentDisposables: Map<atom$TextEditor, IDisposable>;
  _disposables: UniversalDisposable;

  constructor() {
    this._providerRegistry = new ProviderRegistry();
    this._providersChanged = new BehaviorSubject();
    this._statusComponentDisposables = new Map();
    this._settings = new Map(
      featureConfig.getWithDefaults(FEATURE_CONFIG_SETTINGS, []),
    );
    this._disposables = new UniversalDisposable();
    this._disposables.add(() =>
      this._statusComponentDisposables.forEach(d => d.dispose),
    );
    this._disposables.add(
      atom.workspace.observeActiveTextEditor(this._onActiveTextEditor),
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  addProvider(provider: LanguageStatusProvider): IDisposable {
    track('nuclide-language-status:add-provider', {
      provider: provider.name,
    });
    this._disposables.add(this._providerRegistry.addProvider(provider));
    this._providersChanged.next();

    return new UniversalDisposable(() => this._removeProvider(provider));
  }

  _removeProvider(provider: LanguageStatusProvider): void {
    this._providerRegistry.removeProvider(provider);
    this._providersChanged.next();
  }

  // Atom doesn't provide a way to observe all text editors that are
  // visible. We manage this manually by looking at all the panes and
  // keeping track of the active text editors.
  _onActiveTextEditor = (_: ?atom$TextEditor): void => {
    const activePaneItems = atom.workspace
      .getPanes()
      .map(pane => pane.getActiveItem());
    const textEditors = atom.workspace.getTextEditors();
    const activeTextEditors = activePaneItems.filter(item =>
      textEditors.includes(item),
    );
    // Dispose of status components on text editors that are no longer active.
    for (const [editor, disposable] of this._statusComponentDisposables) {
      if (!activeTextEditors.includes(editor)) {
        disposable.dispose();
        this._statusComponentDisposables.delete(editor);
      }
    }
    // Add status components to text editors that are now active.
    for (const editor of activeTextEditors) {
      if (editor == null) {
        continue;
      }

      if (!this._statusComponentDisposables.has(editor)) {
        this._statusComponentDisposables.set(
          editor,
          this._addStatusComponent(editor),
        );
      }
    }
  };

  _onUpdateSettings = (newSettings: Map<string, StatusKind>) => {
    const changedSettings = {};
    for (const [name, kind] of newSettings) {
      if (this._settings.get(name) !== kind) {
        changedSettings[name] = kind;
      }
      this._settings.set(name, kind);
    }
    featureConfig.set(FEATURE_CONFIG_SETTINGS, Array.from(this._settings));
    this._providersChanged.next();
    track('nuclide-language-status.settings-changed', {
      settings: this._settings,
      changedSettings,
    });
  };

  _addStatusComponent = (editor: atom$TextEditor): IDisposable => {
    const props = this._providersChanged
      .switchMap(() => {
        const providers = Array.from(
          this._providerRegistry.getAllProvidersForEditor(editor),
        );
        return providers
          .map(provider => {
            if (!this._settings.has(provider.name)) {
              this._settings.set(provider.name, DEFAULT_SETTINGS_KIND);
            }
            return provider
              .observeStatus(editor)
              .startWith({kind: 'null'})
              .map(data => ({
                provider,
                data,
              }));
          })
          .reduce(
            (a, b) => Observable.combineLatest(a, b, (x, y) => x.concat(y)),
            Observable.of([]),
          );
      })
      .map(serverStatuses => ({
        serverStatuses,
        editor,
        settings: this._settings,
        onUpdateSettings: this._onUpdateSettings,
      }));
    const StatusComponentWithProps = bindObservableAsProps(
      props,
      StatusComponent,
    );

    const disposable = this._renderStatusComponent(
      editor,
      <StatusComponentWithProps />,
    );
    this._disposables.addUntilDestroyed(editor, disposable);
    return disposable;
  };

  _renderStatusComponent(
    editor: atom$TextEditor,
    component: React.Element<any>,
  ): IDisposable {
    const parentDiv: Element = nullthrows(editor.getElement().parentElement);
    const div = document.createElement('div');
    div.style.height = '0';
    const disposable: IDisposable = {
      dispose: () => {
        ReactDOM.unmountComponentAtNode(div);
        div.remove();
      },
    };

    parentDiv.appendChild(div);
    ReactDOM.render(component, div);
    return disposable;
  }
}
