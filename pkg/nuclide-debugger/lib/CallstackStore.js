'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type DebuggerDispatcher, {DebuggerAction} from './DebuggerDispatcher';
import type {Callstack} from './types';

import {
  Disposable,
  CompositeDisposable,
  Emitter,
} from 'atom';
import nuclideUri from '../../commons-node/nuclideUri';
import {ActionTypes} from './DebuggerDispatcher';

export default class CallstackStore {
  _disposables: IDisposable;
  _emitter: Emitter;
  _callstack: ?Callstack;
  _selectedCallFrameIndex: number;
  _selectedCallFrameMarker: ?atom$Marker;

  constructor(dispatcher: DebuggerDispatcher) {
    const dispatcherToken = dispatcher.register(this._handlePayload.bind(this));
    this._disposables = new CompositeDisposable(
      new Disposable(() => {
        dispatcher.unregister(dispatcherToken);
      }),
    );
    this._callstack = null;
    this._selectedCallFrameIndex = 0;
    this._selectedCallFrameMarker = null;
    this._emitter = new Emitter();
  }

  _handlePayload(payload: DebuggerAction) {
    switch (payload.actionType) {
      case ActionTypes.CLEAR_INTERFACE:
        this._handleClearInterface();
        break;
      case ActionTypes.SET_SELECTED_CALLFRAME_LINE:
        // TODO: update _selectedCallFrameIndex.
        this._setSelectedCallFrameLine(payload.data.options);
        break;
      case ActionTypes.OPEN_SOURCE_LOCATION:
        this._openSourceLocation(payload.data.sourceURL, payload.data.lineNumber);
        break;
      case ActionTypes.UPDATE_CALLSTACK:
        this._updateCallstack(payload.data.callstack);
        break;
      case ActionTypes.SET_SELECTED_CALLFRAME_INDEX:
        this._updateSelectedCallFrameIndex(payload.data.index);
        break;
      default:
        return;
    }
  }

  _updateCallstack(callstack: Callstack): void {
    this._selectedCallFrameIndex = 0;
    this._callstack = callstack;
    this._emitter.emit('change');
  }

  _updateSelectedCallFrameIndex(index: number): void {
    this._selectedCallFrameIndex = index;
    this._emitter.emit('change');
  }

  _openSourceLocation(sourceURL: string, lineNumber: number): void {
    const path = nuclideUri.uriToNuclideUri(sourceURL);
    if (path != null && atom.workspace != null) { // only handle real files for now.
      atom.workspace.open(path, {searchAllPanes: true}).then(editor => {
        this._nagivateToLocation(editor, lineNumber);
      });
    }
  }

  _nagivateToLocation(editor: atom$TextEditor, line: number): void {
    editor.scrollToBufferPosition([line, 0]);
    editor.setCursorBufferPosition([line, 0]);
  }

  _handleClearInterface(): void {
    this._selectedCallFrameIndex = 0;
    this._setSelectedCallFrameLine(null);
    this._updateCallstack([]);
  }

  _setSelectedCallFrameLine(options: ?{sourceURL: string, lineNumber: number}) {
    if (options) {
      const path = nuclideUri.uriToNuclideUri(options.sourceURL);
      const {lineNumber} = options;
      if (path != null && atom.workspace != null) { // only handle real files for now
        atom.workspace.open(path, {searchAllPanes: true}).then(editor => {
          this._clearSelectedCallFrameMarker();
          this._highlightCallFrameLine(editor, lineNumber);
          this._nagivateToLocation(editor, lineNumber);
        });
      }
    } else {
      this._clearSelectedCallFrameMarker();
    }
  }

  _highlightCallFrameLine(editor: atom$TextEditor, line: number) {
    const marker = editor.markBufferRange(
      [[line, 0], [line, Infinity]],
      {invalidate: 'never'});
    editor.decorateMarker(marker, {
      type: 'line',
      class: 'nuclide-current-line-highlight',
    });
    this._selectedCallFrameMarker = marker;
  }

  _clearSelectedCallFrameMarker() {
    if (this._selectedCallFrameMarker) {
      this._selectedCallFrameMarker.destroy();
      this._selectedCallFrameMarker = null;
    }
  }

  onChange(callback: () => void): IDisposable {
    return this._emitter.on('change', callback);
  }

  getCallstack(): ?Callstack {
    return this._callstack;
  }

  getSelectedCallFrameIndex(): number {
    return this._selectedCallFrameIndex;
  }

  dispose(): void {
    this._clearSelectedCallFrameMarker();
    this._disposables.dispose();
  }
}
