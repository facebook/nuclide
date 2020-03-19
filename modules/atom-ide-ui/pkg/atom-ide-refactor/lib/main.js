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

/*
 * WARNING: This package is still experimental and in early development. Use it at your own risk.
 */
import type {Store} from './types';
import type {RefactorProvider} from './types';

import invariant from 'assert';
import {getLogger} from 'log4js';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import createPackage from 'nuclide-commons-atom/createPackage';
import observeGrammarForTextEditors from 'nuclide-commons-atom/observe-grammar-for-text-editors';
import {bufferPositionForMouseEvent} from 'nuclide-commons-atom/mouse-to-position';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import ContextMenu from 'nuclide-commons-atom/ContextMenu';

import * as Actions from './refactorActions';
import {getStore} from './refactorStore';
import {initRefactorUIs} from './refactorUIs';

const CONTEXT_MENU_CLASS = 'enable-nuclide-refactorizer';

class Activation {
  _disposables: UniversalDisposable;
  _store: Store;
  _providerRegistry: ProviderRegistry<RefactorProvider>;

  constructor() {
    this._providerRegistry = new ProviderRegistry();

    this._store = getStore(this._providerRegistry);

    let lastMouseEvent = null;
    this._disposables = new UniversalDisposable(
      initRefactorUIs(this._store),
      atom.commands.add(
        'atom-workspace',
        // Since we are trying to move away from menu bar options,
        // we decide not to provide one here. Thus, we suppress the eslint warning.
        // eslint-disable-next-line
        'nuclide-refactorizer:refactorize',
        () => {
          this._store.dispatch(Actions.open('generic'));
        },
      ),
      atom.commands.add(
        'atom-text-editor',
        // We don't actually want people calling this directly.
        // eslint-disable-next-line nuclide-internal/atom-commands
        'nuclide-refactorizer:refactorize-from-context-menu',
        () => {
          const mouseEvent = lastMouseEvent;
          lastMouseEvent = null;
          invariant(
            mouseEvent != null,
            'No mouse event found. Do not invoke this command directly. ' +
              'If you did use the context menu, please report this issue.',
          );
          const editor = atom.workspace.getActiveTextEditor();
          invariant(editor != null);
          const bufferPosition = bufferPositionForMouseEvent(
            mouseEvent,
            editor,
          );
          // If the user selected some text and clicked within it,
          // we'll treat it as a 'range refactor'.
          const currentSelection = editor.getSelectedBufferRange();
          if (!currentSelection.containsPoint(bufferPosition)) {
            editor.setCursorBufferPosition(bufferPosition);
          }

          this._store.dispatch(Actions.open('generic'));
        },
      ),
      atom.contextMenu.add({
        'atom-text-editor:not(.mini).enable-nuclide-refactorizer': [
          {
            label: 'Refactor',
            command: 'nuclide-refactorizer:refactorize-from-context-menu',
            created: event => {
              lastMouseEvent = event;
            },
          },
        ],
      }),
      atom.commands.add(
        'atom-text-editor',
        'nuclide-refactorizer:rename',
        event => {
          const editor = atom.workspace.getActiveTextEditor();
          if (!editor) {
            return null;
          }
          const mouseEvent = ContextMenu.isEventFromContextMenu(event)
            ? lastMouseEvent
            : null;

          const position =
            mouseEvent != null
              ? bufferPositionForMouseEvent(mouseEvent, editor)
              : editor.getCursorBufferPosition();

          editor.setCursorBufferPosition(position);
          editor.selectWordsContainingCursors();
          const selectedText = editor.getSelectedText().trim();
          if (selectedText === '') {
            return null;
          }

          const mountPosition = editor.getSelectedBufferRange().start;

          const renameProviders = Array.from(
            this._providerRegistry.getAllProvidersForEditor(editor),
          ).filter(p => p.rename != null);

          if (renameProviders.length === 0) {
            getLogger('rename').error('Rename Provider Not Found');
            return null;
          }

          this._store.dispatch(
            Actions.displayRename(
              editor,
              renameProviders,
              selectedText,
              mountPosition,
              position,
            ),
          );
        },
      ),
      atom.contextMenu.add({
        'atom-text-editor': [
          {
            label: 'Rename',
            command: 'nuclide-refactorizer:rename',
            created: event => {
              lastMouseEvent = event;
            },
          },
        ],
      }),
      observeGrammarForTextEditors(editor =>
        this._addContextMenuIfEligible(editor),
      ),
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  _addContextMenuIfEligible(editor: atom$TextEditor): void {
    const element = atom.views.getView(editor);
    if (this._providerRegistry.getProviderForEditor(editor) != null) {
      element.classList.add(CONTEXT_MENU_CLASS);
    } else {
      element.classList.remove(CONTEXT_MENU_CLASS);
    }
  }

  _checkAllEditorContextMenus(): void {
    atom.workspace
      .getTextEditors()
      .forEach(editor => this._addContextMenuIfEligible(editor));
  }

  consumeRefactorProvider(provider: RefactorProvider): IDisposable {
    this._providerRegistry.addProvider(provider);
    this._checkAllEditorContextMenus();
    return new UniversalDisposable(() => {
      this._providerRegistry.removeProvider(provider);
      this._checkAllEditorContextMenus();
    });
  }
}

createPackage(module.exports, Activation);
