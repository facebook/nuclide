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

import type BreakpointStore from './BreakpointStore';
import type DebuggerActions from './DebuggerActions';

import {CompositeDisposable} from 'atom';
import {observeTextEditors} from 'nuclide-commons-atom/text-editor';
import BreakpointDisplayController from './BreakpointDisplayController';

export default class BreakpointManager {
  _breakpointStore: BreakpointStore;
  _debuggerActions: DebuggerActions;
  _displayControllers: Map<atom$TextEditor, BreakpointDisplayController>;
  _disposables: CompositeDisposable;

  constructor(store: BreakpointStore, debuggerActions: DebuggerActions) {
    this._breakpointStore = store;
    this._debuggerActions = debuggerActions;
    this._displayControllers = new Map();
    this._disposables = new CompositeDisposable(
      observeTextEditors(this._handleTextEditor.bind(this)),
    );
  }

  dispose(): void {
    this._disposables.dispose();
    this._displayControllers.forEach(controller => controller.dispose());
    this._displayControllers.clear();
  }

  /**
   * Used for testing.
   */
  getDisplayControllers(): Map<atom$TextEditor, BreakpointDisplayController> {
    return this._displayControllers;
  }

  /**
   * Delegate callback from BreakpointDisplayController.
   */
  handleTextEditorDestroyed(controller: BreakpointDisplayController) {
    controller.dispose();
    this._displayControllers.delete(controller.getEditor());
  }

  _handleTextEditor(editor: atom$TextEditor) {
    if (!this._displayControllers.has(editor)) {
      const controller = new BreakpointDisplayController(
        this,
        this._breakpointStore,
        editor,
        this._debuggerActions,
      );
      this._displayControllers.set(editor, controller);
    }
  }
}
