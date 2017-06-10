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

import type {RefactorUIFactory, Store, RefactorState} from './types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import React from 'react';
import ReactDOM from 'react-dom';
import invariant from 'assert';

import {MainRefactorComponent} from './components/MainRefactorComponent';
import * as Actions from './refactorActions';

const refactorUIFactories: Array<RefactorUIFactory> = [
  genericRefactorUI,
  closeOnEscape,
  focusEditorOnClose,
  renameShortcut,
];

export function initRefactorUIs(store: Store): IDisposable {
  const disposables = refactorUIFactories.map(uiFn => uiFn(store));
  return new UniversalDisposable(...disposables);
}

function genericRefactorUI(store: Store): IDisposable {
  const renderer: GenericUIRenderer = new GenericUIRenderer(store);
  const disposeFn: () => void = store.subscribe(() => {
    const state = store.getState();
    if (
      state.type === 'closed' ||
      (state.type === 'open' && state.ui === 'generic')
    ) {
      renderer.renderState(state);
    }
  });
  return new UniversalDisposable(disposeFn);
}

function closeOnEscape(store: Store): IDisposable {
  let escapeSubscription: ?IDisposable = null;
  return new UniversalDisposable(
    store.subscribe(() => {
      const state = store.getState();
      if (state.type === 'open' && escapeSubscription == null) {
        escapeSubscription = atom.commands.add('body', 'core:cancel', () => {
          store.dispatch(Actions.close());
        });
      } else if (state.type === 'closed') {
        invariant(escapeSubscription != null);
        escapeSubscription.dispose();
        escapeSubscription = null;
      }
    }),
  );
}

function focusEditorOnClose(store: Store): IDisposable {
  return new UniversalDisposable(
    store.subscribe(() => {
      const state = store.getState();
      if (state.type === 'closed') {
        const editor = atom.workspace.getActiveTextEditor();
        if (editor == null) {
          return;
        }
        const pane = atom.workspace.paneForItem(editor);
        if (pane == null) {
          return;
        }
        pane.activate();
        pane.activateItem(editor);
      }
    }),
  );
}

function renameShortcut(store: Store): IDisposable {
  const renderer: GenericUIRenderer = new GenericUIRenderer(store);
  return new UniversalDisposable(
    store.subscribe(() => {
      const state = store.getState();
      if (state.type === 'closed') {
        renderer.renderState(state);
        return;
      }
      if (state.ui === 'rename') {
        const {phase} = state;
        switch (phase.type) {
          case 'pick':
            let renameRefactoring = null;
            for (const refactoring of phase.availableRefactorings) {
              if (
                refactoring.kind === 'rename' ||
                (refactoring.kind === 'freeform' &&
                  refactoring.disabled !== false &&
                  refactoring.name.match(/rename/i))
              ) {
                renameRefactoring = refactoring;
                break;
              }
            }
            if (renameRefactoring == null) {
              atom.notifications.addWarning(
                'Unable to rename at this location',
              );
              store.dispatch(Actions.close());
            } else {
              store.dispatch(Actions.pickedRefactor(renameRefactoring));
            }
            break;
          default:
            renderer.renderState(state);
        }
      }
    }),
  );
}

class GenericUIRenderer {
  _panel: ?atom$Panel;
  _store: Store;

  constructor(store: Store) {
    this._store = store;
  }

  renderState(state: RefactorState) {
    if (state.type === 'open') {
      if (this._panel == null) {
        const element = document.createElement('div');
        this._panel = atom.workspace.addModalPanel({item: element});
      }
      ReactDOM.render(
        <MainRefactorComponent appState={state} store={this._store} />,
        this._panel.getItem(),
      );
    } else {
      if (this._panel != null) {
        const panel = this._panel;
        ReactDOM.unmountComponentAtNode(panel.getItem());
        panel.destroy();
        this._panel = null;
      }
    }
  }
}
