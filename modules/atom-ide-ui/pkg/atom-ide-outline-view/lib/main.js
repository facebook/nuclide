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

import ActiveEditorRegistry from 'nuclide-commons-atom/ActiveEditorRegistry';
import {observeActivePaneItemDebounced} from 'nuclide-commons-atom/debounced';
import {isValidTextEditor} from 'nuclide-commons-atom/text-editor';
import createPackage from 'nuclide-commons-atom/createPackage';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import analytics from 'nuclide-commons/analytics';

import {destroyItemWhere} from 'nuclide-commons-atom/destroyItemWhere';

import {OutlineViewPanelState, WORKSPACE_VIEW_URI} from './OutlineViewPanel';
import {createOutlines} from './createOutlines';
import {Observable} from 'rxjs';

import type {Outline, OutlineProvider, ResultsStreamProvider} from './types';

class Activation {
  _disposables: UniversalDisposable;

  _editorService: ActiveEditorRegistry<OutlineProvider, ?Outline>;

  constructor() {
    this._disposables = new UniversalDisposable(
      this.registerOpenerAndCommand(),
    );

    this._editorService = new ActiveEditorRegistry(
      (provider, editor) => provider.getOutline(editor),
      getActiveEditorRegistryEventSources(),
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  consumeOutlineProvider(provider: OutlineProvider): IDisposable {
    return this._editorService.consumeProvider(provider);
  }

  _createOutlineViewPanelState(): OutlineViewPanelState {
    analytics.track('outline-view-show');
    return new OutlineViewPanelState(createOutlines(this._editorService));
  }

  registerOpenerAndCommand(): IDisposable {
    const commandDisposable = atom.commands.add(
      'atom-workspace',
      'outline-view:toggle',
      () => {
        atom.workspace.toggle(WORKSPACE_VIEW_URI);
      },
    );
    return new UniversalDisposable(
      atom.workspace.addOpener(uri => {
        if (uri === WORKSPACE_VIEW_URI) {
          return this._createOutlineViewPanelState();
        }
      }),
      () => {
        destroyItemWhere(item => item instanceof OutlineViewPanelState);
      },
      commandDisposable,
    );
  }

  deserializeOutlineViewPanelState(): OutlineViewPanelState {
    return this._createOutlineViewPanelState();
  }

  getOutlineViewResultsStream(): ResultsStreamProvider {
    return {
      getResultsStream: () => this._editorService.getResultsStream(),
    };
  }
}

createPackage(module.exports, Activation);

// TODO this can be removed once we no longer want to support versions of Atom less than 1.17.0
// (D4973408)
function getActiveEditorRegistryEventSources() {
  return {
    activeEditors: observeActivePaneItemDebounced()
      .switchMap(item => {
        if (isValidTextEditor(item)) {
          return Observable.of(item);
        } else if (item instanceof OutlineViewPanelState) {
          // Ignore switching to the outline view.
          return Observable.empty();
        }
        return Observable.of(null);
      })
      .distinctUntilChanged(),
  };
}
