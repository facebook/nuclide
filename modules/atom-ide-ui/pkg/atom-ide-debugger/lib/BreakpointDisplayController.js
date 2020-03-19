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

import type {IBreakpoint, IDebugService, IUIBreakpoint} from './types';

import invariant from 'assert';
import {bufferPositionForMouseEvent} from 'nuclide-commons-atom/mouse-to-position';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {fastDebounce} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {showMenuForEvent} from 'nuclide-commons-atom/ContextMenu';
import classnames from 'classnames';
import {Observable} from 'rxjs';
import {DebuggerMode} from './constants';
import featureConfig from 'nuclide-commons-atom/feature-config';

/**
 * A single delegate which handles events from the object.
 *
 * This is simpler than registering handlers using emitter events directly, as
 * there's less messy bookkeeping regarding lifetimes of the unregister
 * Disposable objects.
 */
type BreakpointDisplayControllerDelegate = {
  +handleTextEditorDestroyed: (controller: BreakpointDisplayController) => void,
};

type BreakpointMarkerProperties = {|
  enabled: boolean,
  resolved: boolean,
  conditional: boolean,
|};

/**
 * Handles displaying breakpoints and processing events for a single text
 * editor.
 */
export default class BreakpointDisplayController {
  _service: IDebugService;
  _delegate: BreakpointDisplayControllerDelegate;
  _disposables: UniversalDisposable;
  _editor: atom$TextEditor;
  _gutter: ?atom$Gutter;
  _markers: Array<atom$Marker>;
  _markerInfo: Map<number, BreakpointMarkerProperties>;
  _lastShadowBreakpointMarker: ?atom$Marker;
  _boundGlobalMouseMoveHandler: (event: MouseEvent) => void;
  _boundCreateContextMenuHandler: (event: MouseEvent) => void;
  _debugging: boolean;

  constructor(
    delegate: BreakpointDisplayControllerDelegate,
    service: IDebugService,
    editor: atom$TextEditor,
  ) {
    this._delegate = delegate;
    this._disposables = new UniversalDisposable();
    this._service = service;
    this._editor = editor;
    this._markers = [];
    this._markerInfo = new Map();
    this._lastShadowBreakpointMarker = null;
    this._boundGlobalMouseMoveHandler = this._handleGlobalMouseLeave.bind(this);
    this._boundCreateContextMenuHandler = this._handleCreateContextMenu.bind(
      this,
    );
    this._debugging = this._isDebugging();

    // Configure the gutter.
    const gutter = editor.addGutter({
      name: 'debugger-breakpoint',
      visible: false,
      // Priority is -200 by default and 0 is the line number
      priority: -1100,
    });
    const debuggerModel = this._service.getModel();
    this._gutter = gutter;
    this._disposables.addUntilDestroyed(
      editor,
      gutter.onDidDestroy(this._handleGutterDestroyed.bind(this)),
      editor.observeGutters(this._registerGutterMouseHandlers.bind(this)),
      Observable.merge(
        observableFromSubscribeFunction(
          debuggerModel.onDidChangeBreakpoints.bind(debuggerModel),
        ),
        observableFromSubscribeFunction(
          this._service.viewModel.onDidChangeDebuggerFocus.bind(
            this._service.viewModel,
          ),
        ),
      )
        // Debounce to account for bulk updates and not block the UI
        .let(fastDebounce(10))
        .startWith(null)
        .subscribe(this._update.bind(this)),
      this._editor.onDidDestroy(this._handleTextEditorDestroyed.bind(this)),
      this._registerEditorContextMenuHandler(),
    );
  }

  _isDebugging(): boolean {
    return this._service
      .getModel()
      .getProcesses()
      .some(process => process.debuggerMode !== DebuggerMode.STOPPED);
  }

  _registerEditorContextMenuHandler(): IDisposable {
    const editorElement = atom.views.getView(this._editor);
    editorElement.addEventListener(
      'contextmenu',
      this._boundCreateContextMenuHandler,
    );
    return new UniversalDisposable(() =>
      editorElement.removeEventListener(
        'contextmenu',
        this._boundCreateContextMenuHandler,
      ),
    );
  }

  _registerGutterMouseHandlers(gutter: atom$Gutter): void {
    const gutterView = atom.views.getView(gutter);
    if (
      gutter.name !== 'line-number' &&
      gutter.name !== 'debugger-breakpoint'
    ) {
      return;
    }
    const boundClickHandler = this._handleGutterClick.bind(this);
    const boundMouseMoveHandler = this._handleGutterMouseMove.bind(this);
    const boundMouseEnterHandler = this._handleGutterMouseEnter.bind(this);
    const boundMouseLeaveHandler = this._handleGutterMouseLeave.bind(this);
    // Add mouse listeners gutter for setting breakpoints.
    gutterView.addEventListener('click', boundClickHandler);
    gutterView.addEventListener('mousemove', boundMouseMoveHandler);
    gutterView.addEventListener('mouseenter', boundMouseEnterHandler);
    gutterView.addEventListener('mouseleave', boundMouseLeaveHandler);
    gutterView.addEventListener(
      'contextmenu',
      this._boundCreateContextMenuHandler,
    );
    this._disposables.add(
      () => gutterView.removeEventListener('click', boundClickHandler),
      () => gutterView.removeEventListener('mousemove', boundMouseMoveHandler),
      () =>
        gutterView.removeEventListener('mouseenter', boundMouseEnterHandler),
      () =>
        gutterView.removeEventListener('mouseleave', boundMouseLeaveHandler),
      () =>
        gutterView.removeEventListener(
          'contextmenu',
          this._boundCreateContextMenuHandler,
        ),
      () =>
        window.removeEventListener(
          'mousemove',
          this._boundGlobalMouseMoveHandler,
        ),
    );
  }

  _handleCreateContextMenu(event: MouseEvent): void {
    if (event.button !== 2 || !this._isDebugging()) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const menuTemplate = atom.contextMenu.templateForEvent(event);
    const debuggerGroupIndex = menuTemplate.findIndex(
      item => item.label === 'Debugger',
    );
    const [debuggerGroup] = menuTemplate.splice(debuggerGroupIndex, 1);
    menuTemplate.unshift(...debuggerGroup.submenu, {type: 'separator'});
    showMenuForEvent(event, menuTemplate);
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

  _needsUpdate(line: number, bp: ?IBreakpoint): boolean {
    // Checks if an existing marker no longer matches the properties of the breakpoint
    // it corresponds to.
    if (bp == null) {
      return true;
    }

    const info = this._markerInfo.get(line);
    if (info == null) {
      return true;
    }

    if (
      info.enabled !== bp.enabled ||
      info.resolved !== bp.verified ||
      info.conditional !== (bp.condition != null)
    ) {
      return true;
    }

    return false;
  }

  _getLineForBp(bp: IBreakpoint): number {
    // Zero-based breakpoints line map (to match UI markers).
    return bp.line - 1;
  }

  /**
   * Update the display with the current set of breakpoints for this editor.
   */
  _update(): void {
    const gutter = this._gutter;
    if (gutter == null) {
      return;
    }

    const debugging = this._isDebugging();

    const path = this._editor.getPath();
    if (path == null) {
      return;
    }
    const allBreakpoints = this._service.getModel().getBreakpoints();
    const breakpoints = allBreakpoints.filter(bp => bp.uri === path);
    const lineMap = new Map(
      breakpoints.map(bp => [this._getLineForBp(bp), bp]),
    );

    // A mutable unhandled lines map.
    const unhandledLines = new Set(lineMap.keys());
    const markersToKeep = [];

    // Destroy markers that no longer correspond to breakpoints.
    this._markers.forEach(marker => {
      const line = marker.getStartBufferPosition().row;
      const bp = lineMap.get(line);
      if (
        debugging === this._debugging &&
        unhandledLines.has(line) &&
        !this._needsUpdate(line, bp)
      ) {
        markersToKeep.push(marker);
        unhandledLines.delete(line);
      } else {
        this._markerInfo.delete(line);
        marker.destroy();
      }
    });

    this._debugging = debugging;

    const fileLength = this._editor.getLineCount();

    // Add new markers for breakpoints without corresponding markers.
    for (const [line, breakpoint] of lineMap) {
      // Remove any breakpoints that are past the end of the file.
      if (line >= fileLength) {
        this._service.removeBreakpoints(breakpoint.getId());
        continue;
      }

      if (!unhandledLines.has(line)) {
        // This line has been handled.
        continue;
      }
      const marker = this._createBreakpointMarkerAtLine(
        line,
        false, // isShadow
        breakpoint,
      );

      // Remember the properties of the marker at this line so it's easy to tell if it
      // needs to be updated when the breakpoint properties change.
      this._markerInfo.set(line, {
        enabled: breakpoint.enabled,
        resolved: breakpoint.verified,
        conditional: breakpoint.condition != null,
      });
      marker.onDidChange(this._handleMarkerChange.bind(this, breakpoint));
      markersToKeep.push(marker);
    }

    gutter.show();
    this._markers = markersToKeep;
  }

  /**
   * Handler for marker movements due to text being edited.
   */
  _handleMarkerChange(
    breakpoint: IBreakpoint,
    event: atom$MarkerChangeEvent,
  ): void {
    const path = this._editor.getPath();
    if (path == null || path.length === 0) {
      return;
    }
    if (!event.isValid) {
      this._service.removeBreakpoints(breakpoint.getId());
    } else if (
      event.oldHeadBufferPosition.row !== event.newHeadBufferPosition.row
    ) {
      const newBp: IUIBreakpoint = {
        // VSP is 1-based line numbers.
        line: event.newHeadBufferPosition.row + 1,
        id: breakpoint.getId(),
        uri: breakpoint.uri,
        column: 0,
        enabled: breakpoint.enabled,
      };

      if (breakpoint.condition != null) {
        newBp.condition = breakpoint.condition;
      }

      this._service.updateBreakpoints([newBp]);
    }
  }

  _handleGutterClick(event: Event): void {
    // classList isn't in the defs of EventTarget...
    const target: HTMLElement = (event.target: any);
    if (target.classList.contains('icon-right')) {
      return;
    }

    const path = this._editor.getPath();
    // flowlint-next-line sketchy-null-string:off
    if (!path) {
      return;
    }

    // Don't toggle a breakpoint if the user clicked on something in the gutter that is not
    // the debugger, such as clicking on a line number to select the line.
    if (
      !target.classList.contains('debugger-shadow-breakpoint-icon') &&
      !target.classList.contains('debugger-breakpoint-icon') &&
      !target.classList.contains('debugger-breakpoint-icon-disabled') &&
      !target.classList.contains('debugger-breakpoint-icon-unresolved') &&
      !target.classList.contains('debugger-breakpoint-icon-conditional')
    ) {
      return;
    }

    try {
      const curLine = this._getCurrentMouseEventLine(event);
      this._service.toggleSourceBreakpoint(path, curLine + 1);

      if (
        this._service.getModel().getBreakpointAtLine(path, curLine + 1) != null
      ) {
        // If a breakpoint was added and showDebuggerOnBpSet config setting
        // is true, show the debugger.
        if (featureConfig.get('atom-ide-debugger.showDebuggerOnBpSet')) {
          atom.commands.dispatch(
            atom.views.getView(atom.workspace),
            'debugger:show',
            {
              showOnlyIfHidden: true,
            },
          );
        }
      }
    } catch (e) {
      return;
    }
  }

  _getCurrentMouseEventLine(event: Event): number {
    // $FlowIssue
    const bufferPos = bufferPositionForMouseEvent(event, this._editor);
    return bufferPos.row;
  }

  _handleGutterMouseMove(event: Event): void {
    try {
      const curLine = this._getCurrentMouseEventLine(event);
      if (this._isLineOverLastShadowBreakpoint(curLine)) {
        return;
      }
      // User moves to a new line we need to delete the old shadow breakpoint
      // and create a new one.
      this._removeLastShadowBreakpoint();
      this._createShadowBreakpointAtLine(this._editor, curLine);
    } catch (e) {
      return;
    }
  }

  _handleGutterMouseEnter(event: Event): void {
    window.addEventListener('mousemove', this._boundGlobalMouseMoveHandler);
  }

  // This is a giant hack to make sure that the breakpoint actually disappears.
  // The issue is that mouseleave event is sometimes not triggered on the gutter
  // I(vjeux) and matthewithanm spent multiple entire days trying to figure out
  // why without success, so this is going to have to do :(
  _handleGlobalMouseLeave(event: MouseEvent): void {
    if (!this._editor) {
      return;
    }
    const view = atom.views.getView(this._editor);
    const rect = view.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      this._removeLastShadowBreakpoint();
      window.removeEventListener(
        'mousemove',
        this._boundGlobalMouseMoveHandler,
      );
    }
  }

  _handleGutterMouseLeave(event: Event): void {
    this._removeLastShadowBreakpoint();
  }

  _isLineOverLastShadowBreakpoint(curLine: number): boolean {
    const shadowBreakpointMarker = this._lastShadowBreakpointMarker;
    return (
      shadowBreakpointMarker != null &&
      shadowBreakpointMarker.getStartBufferPosition().row === curLine
    );
  }

  _removeLastShadowBreakpoint(): void {
    if (this._lastShadowBreakpointMarker != null) {
      this._lastShadowBreakpointMarker.destroy();
      this._lastShadowBreakpointMarker = null;
    }
  }

  _createShadowBreakpointAtLine(editor: TextEditor, line: number): void {
    const breakpointsAtLine = this._markers.filter(
      marker => marker.getStartBufferPosition().row === line,
    );

    // Don't create a shadow breakpoint at a line that already has a breakpoint.
    if (breakpointsAtLine.length === 0) {
      this._lastShadowBreakpointMarker = this._createBreakpointMarkerAtLine(
        line,
        true, // isShadow
        null,
      );
    }
  }

  _createBreakpointMarkerAtLine(
    line: number,
    isShadow: boolean,
    breakpoint: ?IBreakpoint,
  ): atom$Marker {
    const enabled = breakpoint != null ? breakpoint.enabled : true;
    const resolved = breakpoint != null ? breakpoint.verified : false;
    const condition = breakpoint != null ? breakpoint.condition : null;
    const marker = this._editor.markBufferPosition([line, 0], {
      invalidate: 'never',
    });

    // If the debugger is not attached, display all breakpoints as resolved.
    // Once the debugger attaches, it will determine what's actually resolved or not.
    const unresolved = this._debugging && !resolved;
    const conditional = condition != null;
    const elem: HTMLElement = document.createElement('span');
    elem.dataset.line = line.toString();

    if (breakpoint != null) {
      elem.dataset.bpId = breakpoint.getId();
    }

    elem.className = classnames({
      'debugger-breakpoint-icon': !isShadow && enabled && !unresolved,
      'debugger-breakpoint-icon-conditional': conditional,
      'debugger-breakpoint-icon-nonconditional': !conditional,
      'debugger-shadow-breakpoint-icon': isShadow,
      'debugger-breakpoint-icon-disabled': !isShadow && !enabled,
      'debugger-breakpoint-icon-unresolved': !isShadow && enabled && unresolved,
    });

    if (!isShadow) {
      if (!enabled) {
        elem.title = 'Disabled breakpoint';
      } else if (unresolved) {
        elem.title = 'Unresolved breakpoint';
      } else {
        elem.title = 'Breakpoint';
      }

      if (conditional) {
        elem.title += ` (Condition: ${condition || ''})`;
      }
    }

    invariant(this._gutter != null);
    this._gutter.decorateMarker(marker, {item: elem});
    return marker;
  }
}
