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

import type {IDebugService} from './types';

import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import BreakpointDisplayController from './BreakpointDisplayController';

export default class BreakpointManager {
  _service: IDebugService;
  _displayControllers: Map<atom$TextEditor, BreakpointDisplayController>;
  _disposables: UniversalDisposable;

  constructor(service: IDebugService) {
    this._service = service;
    this._displayControllers = new Map();
    this._disposables = new UniversalDisposable(
      atom.workspace.observeTextEditors(this._handleTextEditor.bind(this)),
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
        this._service,
        editor,
      );
      this._displayControllers.set(editor, controller);
    }
  }
}
