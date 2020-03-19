/**
 * Copyright (c) 2017-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree. An additional grant
 * of patent rights can be found in the PATENTS file in the same directory.
 *
 * @flow strict-local
 * @format
 */

import type {RefactorProvider} from './types';
import type {RefactorUIFactory, Store, RefactorState} from './types';

import ReactMountRootElement from 'nuclide-commons-ui/ReactMountRootElement';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import * as React from 'react';
import ReactDOM from 'react-dom';
import invariant from 'assert';
import {Range} from 'atom';

import {Observable} from 'rxjs';
import RenameComponent from './components/RenameComponent';
import type {Props as RenameComponentPropsType} from './components/RenameComponent';
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
  const genericRenderer: GenericUIRenderer = new GenericUIRenderer(store);
  const inlineRenameRenderer: InlineRenameRenderer = new InlineRenameRenderer(
    store,
  );
  const disposeFn: () => void = store.subscribe(() => {
    const state = store.getState();
    if (
      state.type === 'closed' ||
      (state.type === 'open' &&
        (state.ui === 'generic' || state.ui === 'rename'))
    ) {
      genericRenderer.renderState(state);
      inlineRenameRenderer.renderState(state);
    }
  });
  return new UniversalDisposable(
    disposeFn,
    genericRenderer,
    inlineRenameRenderer,
  );
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
    if (state.type === 'open' && state.phase.type !== 'rename') {
      if (this._panel == null) {
        const element = document.createElement('div');
        this._panel = atom.workspace.addModalPanel({item: element});
      }
      ReactDOM.render(
        <MainRefactorComponent appState={state} store={this._store} />,
        this._panel.getItem(),
      );
    } else {
      this.dispose();
    }
  }

  dispose() {
    if (this._panel != null) {
      const panel = this._panel;
      ReactDOM.unmountComponentAtNode(panel.getItem());
      panel.destroy();
      this._panel = null;
    }
  }
}

class InlineRenameRenderer {
  _store: Store;
  _disposable: ?IDisposable;

  constructor(store: Store) {
    this._store = store;
  }

  renderRenameInput(
    editor: atom$TextEditor,
    selectedText: string,
    providers: RefactorProvider[],
    symbolPosition: atom$Point,
  ): React.Element<React.ComponentType<RenameComponentPropsType>> {
    return (
      <RenameComponent
        selectedText={selectedText}
        providers={providers}
        parentEditor={editor}
        store={this._store}
        symbolPosition={symbolPosition}
      />
    );
  }

  mountRenameInput(
    editor: atom$TextEditor,
    mountPosition: atom$Point,
    container: ReactMountRootElement,
    element: React.Element<React.ComponentType<RenameComponentPropsType>>,
  ): IDisposable {
    const overlayMarker = editor.markBufferRange(
      new Range(mountPosition, mountPosition),
      {
        invalidate: 'never',
      },
    );

    editor.decorateMarker(overlayMarker, {
      type: 'overlay',
      position: 'tail',
      item: container,
    });

    return new UniversalDisposable(
      () => overlayMarker.destroy(),
      () => ReactDOM.unmountComponentAtNode(container),

      // The editor may not mount the marker until the next update.
      // It's not safe to render anything until that point, as overlayed containers
      // often need to measure their size in the DOM.
      Observable.from(editor.getElement().getNextUpdatePromise()).subscribe(
        () => {
          container.style.display = 'block';
          ReactDOM.render(element, container);
        },
      ),

      // After enabling `insert-mode` in RenameComponent.js for those who use
      //  the `vim-mode-plus` package, the user has to press `esc` to return to `normal-mode`.
      //  We execute this command manually for them here.
      //  Since most users of this package operate by default in normal mode,
      //  we assume that they'd like to return to this mode after executing the rename.
      () =>
        atom.commands.dispatch(
          atom.views.getView(editor),
          'vim-mode-plus:activate-normal-mode',
        ),
    );
  }

  renderState(state: RefactorState) {
    if (state.type === 'open' && state.phase.type === 'rename') {
      const container = new ReactMountRootElement();
      container.className = 'nuclide-refactorizer-rename-container';

      const {
        providers,
        editor,
        selectedText,
        mountPosition,
        symbolPosition,
      } = state.phase;

      const renameElement = this.renderRenameInput(
        editor,
        selectedText,
        providers,
        symbolPosition,
      );

      this._disposable = this.mountRenameInput(
        editor,
        mountPosition,
        container,
        renameElement,
      );
    } else {
      this.dispose();
    }
  }

  dispose(): void {
    if (this._disposable != null) {
      this._disposable.dispose();
      this._disposable = null;
    }
  }
}
