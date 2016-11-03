'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type BreakpointStore from './BreakpointStore';
import type DebuggerActions from './DebuggerActions';

import invariant from 'assert';
import {CompositeDisposable, Disposable} from 'atom';

const DIFF_VIEW_NAVIGATION_TARGET = 'nuclide-diff-view-navigation-target';
const DIFF_VIEW_NAVIGATION_BAR = 'nuclide-diff-view-navigation-bar';

/**
 * A single delegate which handles events from the object.
 *
 * This is simpler than registering handlers using emitter events directly, as
 * there's less messy bookkeeping regarding lifetimes of the unregister
 * Disposable objects.
 */
type BreakpointDisplayControllerDelegate = {
  handleTextEditorDestroyed: (controller: BreakpointDisplayController) => void,
};

/**
 * Handles displaying breakpoints and processing events for a single text
 * editor.
 */
class BreakpointDisplayController {
  _breakpointStore: BreakpointStore;
  _debuggerActions: DebuggerActions;
  _delegate: BreakpointDisplayControllerDelegate;
  _disposables: CompositeDisposable;
  _editor: atom$TextEditor;
  _gutter: ?atom$Gutter;
  _markers: Array<atom$Marker>;
  _lastShadowBreakpointMarker: ?atom$Marker;

  constructor(
    delegate: BreakpointDisplayControllerDelegate,
    breakpointStore: BreakpointStore,
    editor: atom$TextEditor,
    debuggerActions: DebuggerActions,
  ) {
    this._delegate = delegate;
    this._disposables = new CompositeDisposable();
    this._breakpointStore = breakpointStore;
    this._debuggerActions = debuggerActions;
    this._editor = editor;
    this._markers = [];
    this._lastShadowBreakpointMarker = null;

    // Configure the gutter.
    const gutter = editor.addGutter({
      name: 'nuclide-breakpoint',
      visible: false,
      // Priority is -200 by default and 0 is the line number
      priority: -1100,
    });
    this._gutter = gutter;
    this._registerGutterMouseHandlers(
      (atom.views.getView(editor): any)
        .component.gutterContainerComponent.getDomNode(),
    );

    this._disposables.add(
      gutter.onDidDestroy(this._handleGutterDestroyed.bind(this)),
      this._breakpointStore.onNeedUIUpdate(this._handleBreakpointsChanged.bind(this)),
      this._editor.onDidDestroy(this._handleTextEditorDestroyed.bind(this)),
    );
    this._update();
  }

  _registerGutterMouseHandlers(gutterView: HTMLElement): void {
    const boundClickHandler = this._handleGutterClick.bind(this);
    const boundMouseMoveHandler =
      this._handleGutterMouseMove.bind(this);
    const boundMouseLeaveHandler =
      this._handleGutterMouseLeave.bind(this);
    // Add mouse listeners gutter for setting breakpoints.
    gutterView.addEventListener('click', boundClickHandler);
    gutterView.addEventListener('mousemove', boundMouseMoveHandler);
    gutterView.addEventListener('mouseleave', boundMouseLeaveHandler);
    this._disposables.add(new Disposable(() => {
      gutterView.removeEventListener('click', boundClickHandler);
      gutterView.removeEventListener('mousemove', boundMouseMoveHandler);
      gutterView.removeEventListener('mouseleave', boundMouseLeaveHandler);
    }));
  }

  dispose() {
    this._disposables.dispose();
    this._markers.forEach(marker => marker.destroy());
    if (this._gutter) {
      this._gutter.destroy();
    }
  }

  getEditor(): atom$TextEditor {
    return this._editor;
  }

  _handleTextEditorDestroyed() {
    // Gutter.destroy seems to fail after text editor is destroyed, and
    // Gutter.onDidDestroy doesn't seem to be called in that case.
    this._gutter = null;
    this._delegate.handleTextEditorDestroyed(this);
  }

  _handleGutterDestroyed() {
    // If gutter is destroyed by some outside force, ensure the gutter is not
    // destroyed again.
    this._gutter = null;
  }

  /**
   * Update the display with the current set of breakpoints for this editor.
   */
  _update(): void {
    const gutter = this._gutter;
    if (gutter == null) {
      return;
    }

    const path = this._editor.getPath();
    if (path == null) {
      return;
    }
    const breakpoints = this._breakpointStore.getBreakpointsForPath(path);
    // A mutable unhandled lines map.
    const unhandledLines = this._breakpointStore.getBreakpointLinesForPath(path);
    const markersToKeep = [];

    // Destroy markers that no longer correspond to breakpoints.
    this._markers.forEach(marker => {
      const line = marker.getStartBufferPosition().row;
      if (unhandledLines.has(line)) {
        markersToKeep.push(marker);
        unhandledLines.delete(line);
      } else {
        marker.destroy();
      }
    });

    // Add new markers for breakpoints without corresponding markers.
    for (const [line] of breakpoints) {
      if (!unhandledLines.has(line)) {
        // This line has been handled.
        continue;
      }
      const marker = this._createBreakpointMarkerAtLine(
        line,
        false, // isShadow
      );
      marker.onDidChange(this._handleMarkerChange.bind(this));
      markersToKeep.push(marker);
    }

    gutter.show();
    this._markers = markersToKeep;
  }

  /**
   * Handler for marker movements due to text being edited.
   */
  _handleMarkerChange(event: Object) {
    const path = this._editor.getPath();
    if (!path) {
      return;
    }
    if (!event.isValid) {
      this._debuggerActions.deleteBreakpoint(path, event.newHeadBufferPosition.row);
    } else if (event.oldHeadBufferPosition.row !== event.newHeadBufferPosition.row) {
      this._debuggerActions.deleteBreakpoint(path, event.oldHeadBufferPosition.row);
      this._debuggerActions.addBreakpoint(path, event.newHeadBufferPosition.row);
    }
  }

  _handleBreakpointsChanged(path: string): void {
    if (path === this._editor.getPath()) {
      this._update();
    }
  }

  _handleGutterClick(event: Event): void {
    // Filter out clicks to the folding chevron.
    const FOLDING_CHEVRON_CLASS_NAME = 'icon-right';
    const BLAME_HASH_CLICKABLE_CLASS_NAME = 'nuclide-blame-hash-clickable';
    // classList isn't in the defs of EventTarget...
    const target: HTMLElement = (event.target: any);
    const ignoreClickClassNames = [
      FOLDING_CHEVRON_CLASS_NAME,
      BLAME_HASH_CLICKABLE_CLASS_NAME,
      DIFF_VIEW_NAVIGATION_TARGET,
    ];
    if (ignoreClickClassNames.some(className => target.classList.contains(className))) {
      return;
    }

    const path = this._editor.getPath();
    if (!path) {
      return;
    }
    this._debuggerActions.toggleBreakpoint(path, this._getCurrentMouseEventLine(event));
  }

  _getCurrentMouseEventLine(event: Event): number {
    // Beware, screenPositionForMouseEvent is not a public api and may change in future versions.
    // $FlowIssue
    const screenPos = atom.views.getView(this._editor).component.screenPositionForMouseEvent(event);
    const bufferPos = this._editor.bufferPositionForScreenPosition(screenPos);
    return bufferPos.row;
  }

  _handleGutterMouseMove(event: Event): void {
    const curLine = this._getCurrentMouseEventLine(event);
    // classList isn't in the defs of EventTarget...
    const target: HTMLElement = (event.target: any);
    const ignoreMouseMoveClassNames = [DIFF_VIEW_NAVIGATION_TARGET, DIFF_VIEW_NAVIGATION_BAR];
    if (
      this._isLineOverLastShadowBreakpoint(curLine) ||
      ignoreMouseMoveClassNames.some(className => target.classList.contains(className))
    ) {
      return;
    }
    // User moves to a new line we need to delete the old shadow breakpoint
    // and create a new one.
    this._removeLastShadowBreakpoint();
    this._createShadowBreakpointAtLine(this._editor, curLine);
  }

  _handleGutterMouseLeave(event: Event): void {
    this._removeLastShadowBreakpoint();
  }

  _isLineOverLastShadowBreakpoint(curLine: number): boolean {
    const shadowBreakpointMarker = this._lastShadowBreakpointMarker;
    return shadowBreakpointMarker != null &&
      shadowBreakpointMarker.getStartBufferPosition().row === curLine;
  }

  _removeLastShadowBreakpoint(): void {
    if (this._lastShadowBreakpointMarker != null) {
      this._lastShadowBreakpointMarker.destroy();
      this._lastShadowBreakpointMarker = null;
    }
  }

  _createShadowBreakpointAtLine(editor: TextEditor, line: number): void {
    this._lastShadowBreakpointMarker = this._createBreakpointMarkerAtLine(
      line,
      true, // isShadow
    );
  }

  _createBreakpointMarkerAtLine(
    line: number,
    isShadow: boolean,
  ): atom$Marker {
    const marker = this._editor.markBufferPosition([line, 0], {
      invalidate: 'never',
    });
    const elem: HTMLAnchorElement = document.createElement('a');
    elem.className = isShadow ? 'nuclide-debugger-shadow-breakpoint-icon' :
      'nuclide-debugger-breakpoint-icon';
    invariant(this._gutter != null);
    this._gutter.decorateMarker(marker, {item: elem});
    return marker;
  }
}

module.exports = BreakpointDisplayController;
