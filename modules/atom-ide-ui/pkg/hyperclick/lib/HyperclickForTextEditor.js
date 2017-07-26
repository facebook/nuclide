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

/* global localStorage */

import type {HyperclickSuggestion} from './types';
import type Hyperclick from './Hyperclick';

import {CompositeDisposable, Disposable, Point} from 'atom';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {wordAtPosition} from 'nuclide-commons-atom/range';
import {isPositionInRange} from 'nuclide-commons/range';
import showTriggerConflictWarning from './showTriggerConflictWarning';
import invariant from 'assert';

import {getLogger} from 'log4js';

const WARN_ABOUT_TRIGGER_CONFLICT_KEY = 'hyperclick.warnAboutTriggerConflict';

/**
 * Construct this object to enable Hyperclick in a text editor.
 * Call `dispose` to disable the feature.
 */
export default class HyperclickForTextEditor {
  _textEditor: atom$TextEditor;
  _textEditorView: atom$TextEditorElement;
  _hyperclick: Hyperclick;
  _lastMouseEvent: ?MouseEvent;
  _lastPosition: ?atom$Point;
  _lastSuggestionAtMousePromise: ?Promise<?HyperclickSuggestion>;
  _lastSuggestionAtMouse: ?HyperclickSuggestion;
  _navigationMarkers: ?Array<atom$Marker>;
  _lastWordRange: ?atom$Range;
  _onMouseMove: (event: Event) => void;
  _onMouseDown: (event: Event) => void;
  _onKeyDown: (event: Event) => void;
  _onKeyUp: (event: Event) => void;
  _subscriptions: atom$CompositeDisposable;
  _isDestroyed: boolean;
  _isLoading: boolean;
  _triggerKeys: Set<'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>;

  constructor(textEditor: atom$TextEditor, hyperclick: Hyperclick) {
    this._textEditor = textEditor;
    this._textEditorView = atom.views.getView(textEditor);

    this._hyperclick = hyperclick;

    this._lastMouseEvent = null;
    this._lastPosition = null;
    // We store the original promise that we use to retrieve the last suggestion
    // so callers can also await it to know when it's available.
    this._lastSuggestionAtMousePromise = null;
    // We store the last suggestion since we must await it immediately anyway.
    this._lastSuggestionAtMouse = null;
    this._navigationMarkers = null;

    this._lastWordRange = null;
    this._subscriptions = new CompositeDisposable();

    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._setupMouseListeners();

    this._onKeyDown = this._onKeyDown.bind(this);
    this._textEditorView.addEventListener('keydown', this._onKeyDown);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._textEditorView.addEventListener('keyup', this._onKeyUp);
    (this: any)._onContextMenu = this._onContextMenu.bind(this);
    this._textEditorView.addEventListener('contextmenu', this._onContextMenu);

    this._subscriptions.add(
      atom.commands.add(this._textEditorView, {
        'hyperclick:confirm-cursor': () => this._confirmSuggestionAtCursor(),
      }),
    );

    this._isDestroyed = false;
    this._isLoading = false;

    this._subscriptions.add(
      featureConfig.observe(
        process.platform === 'darwin'
          ? 'hyperclick.darwinTriggerKeys'
          : process.platform === 'win32'
            ? 'hyperclick.win32TriggerKeys'
            : 'hyperclick.linuxTriggerKeys',
        newValue_ => {
          const newValue = ((newValue_: any): string);
          // For all Flow knows, newValue.split could return any old strings
          this._triggerKeys = (new Set(newValue.split(',')): Set<any>);
        },
      ),
    );
  }

  _setupMouseListeners(): void {
    const getLinesDomNode = (): ?HTMLElement => {
      const {component} = this._textEditorView;
      invariant(component);
      if (component.refs != null) {
        return component.refs.lineTiles;
      } else {
        return component.linesComponent.getDomNode();
      }
    };
    const addMouseListeners = () => {
      const {component} = this._textEditorView;
      invariant(component);
      const linesDomNode = getLinesDomNode();
      if (linesDomNode == null) {
        return;
      }
      linesDomNode.addEventListener('mousedown', this._onMouseDown);
      linesDomNode.addEventListener('mousemove', this._onMouseMove);
      const removalDisposable = new Disposable(() => {
        linesDomNode.removeEventListener('mousedown', this._onMouseDown);
        linesDomNode.removeEventListener('mousemove', this._onMouseMove);
      });
      this._subscriptions.add(removalDisposable);
      this._subscriptions.add(
        this._textEditorView.onDidDetach(() => removalDisposable.dispose()),
      );
    };
    if (
      this._textEditorView.component &&
      this._textEditorView.parentNode != null
    ) {
      addMouseListeners();
    } else {
      this._subscriptions.add(
        this._textEditorView.onDidAttach(addMouseListeners),
      );
    }
  }

  _confirmSuggestion(suggestion: HyperclickSuggestion): void {
    if (Array.isArray(suggestion.callback) && suggestion.callback.length > 0) {
      this._hyperclick.showSuggestionList(this._textEditor, suggestion);
    } else {
      invariant(typeof suggestion.callback === 'function');
      const openExternal = atom.config.get('hyperclick.openExternal');
      suggestion.callback(openExternal);
    }
  }

  _onContextMenu(event: Event): void {
    const mouseEvent: MouseEvent = (event: any);
    // If the key trigger happens to cause the context menu to show up, then
    // cancel it. By this point, it's too late to know if you're at a suggestion
    // position to be more fine grained. So if your trigger keys are "ctrl+cmd",
    // then you can't use that combination to bring up the context menu.
    if (this._isHyperclickEvent(mouseEvent)) {
      event.stopPropagation();
    }
  }

  _onMouseMove(event: Event): void {
    const mouseEvent: MouseEvent = (event: any);
    if (this._isLoading) {
      // Show the loading cursor.
      this._textEditorView.classList.add('hyperclick-loading');
    }

    // We save the last `MouseEvent` so the user can trigger Hyperclick by
    // pressing the key without moving the mouse again. We only save the
    // relevant properties to prevent retaining a reference to the event.
    this._lastMouseEvent = ({
      clientX: mouseEvent.clientX,
      clientY: mouseEvent.clientY,
    }: any);

    // Don't fetch suggestions if the mouse is still in the same 'word', where
    // 'word' is defined by the wordRegExp at the current position.
    //
    // If the last suggestion had multiple ranges, we have no choice but to
    // fetch suggestions because the new word might be between those ranges.
    // This should be ok because it will reuse that last suggestion until the
    // mouse moves off of it.
    const lastSuggestionIsNotMultiRange =
      !this._lastSuggestionAtMouse ||
      !Array.isArray(this._lastSuggestionAtMouse.range);
    if (this._isMouseAtLastWordRange() && lastSuggestionIsNotMultiRange) {
      return;
    }
    const match = wordAtPosition(
      this._textEditor,
      this._getMousePositionAsBufferPosition(),
    );
    this._lastWordRange = match != null ? match.range : null;

    if (this._isHyperclickEvent(mouseEvent)) {
      // Clear the suggestion if the mouse moved out of the range.
      if (!this._isMouseAtLastSuggestion()) {
        this._clearSuggestion();
      }
      this._setSuggestionForLastMouseEvent();
    } else {
      this._clearSuggestion();
    }
  }

  _onMouseDown(event: Event): void {
    const mouseEvent: MouseEvent = (event: any);
    const isHyperclickEvent = this._isHyperclickEvent(mouseEvent);

    // If hyperclick and multicursor are using the same trigger, prevent multicursor.
    if (isHyperclickEvent && isMulticursorEvent(mouseEvent)) {
      mouseEvent.stopPropagation();
      if (localStorage.getItem(WARN_ABOUT_TRIGGER_CONFLICT_KEY) !== 'false') {
        localStorage.setItem(WARN_ABOUT_TRIGGER_CONFLICT_KEY, 'false');
        showTriggerConflictWarning();
      }
    }

    if (!isHyperclickEvent || !this._isMouseAtLastSuggestion()) {
      return;
    }

    if (this._lastSuggestionAtMouse) {
      const lastSuggestionAtMouse = this._lastSuggestionAtMouse;
      // Move the cursor to the click location to force a navigation-stack push.
      const newCursorPosition = this._getMousePositionAsBufferPosition();
      this._textEditor.setCursorBufferPosition(newCursorPosition);

      this._confirmSuggestion(lastSuggestionAtMouse);
      // Prevent the <meta-click> event from adding another cursor.
      event.stopPropagation();
    }

    this._clearSuggestion();
  }

  _onKeyDown(event: Event): void {
    const mouseEvent: MouseEvent = (event: any);
    // Show the suggestion at the last known mouse position.
    if (this._isHyperclickEvent(mouseEvent)) {
      this._setSuggestionForLastMouseEvent();
    }
  }

  _onKeyUp(event: Event): void {
    const mouseEvent: MouseEvent = (event: any);
    if (!this._isHyperclickEvent(mouseEvent)) {
      this._clearSuggestion();
    }
  }

  /**
   * Returns a `Promise` that's resolved when the latest suggestion's available.
   */
  getSuggestionAtMouse(): Promise<?HyperclickSuggestion> {
    return this._lastSuggestionAtMousePromise || Promise.resolve(null);
  }

  async _setSuggestionForLastMouseEvent(): Promise<void> {
    if (!this._lastMouseEvent) {
      return;
    }

    const position = this._getMousePositionAsBufferPosition();

    if (this._lastSuggestionAtMouse != null) {
      const {range} = this._lastSuggestionAtMouse;
      invariant(range, 'Hyperclick result must have a valid Range');
      if (isPositionInRange(position, range)) {
        return;
      }
    }

    // if we don't have any prior hyperclick position data, or we don't
    // have any prior suggestion data, or the cursor has moved since the
    // last suggestion, then refetch hyperclick suggestions. Otherwise,
    // we might be able to reuse it below.
    if (
      !this._lastPosition ||
      !this._lastSuggestionAtMouse ||
      position.compare(this._lastPosition) !== 0
    ) {
      this._isLoading = true;
      this._lastPosition = position;

      try {
        this._lastSuggestionAtMousePromise = this._hyperclick.getSuggestion(
          this._textEditor,
          position,
        );
        this._lastSuggestionAtMouse = await this._lastSuggestionAtMousePromise;
      } catch (e) {
        getLogger('hyperclick').error(
          'Error getting Hyperclick suggestion:',
          e,
        );
      } finally {
        this._doneLoading();
      }
    }

    // it's possible that the text editor buffer (and therefore this hyperclick
    // provider for the editor) has been closed by the user since we
    // asynchronously queried for suggestions.
    if (this._isDestroyed) {
      return;
    }

    if (this._lastSuggestionAtMouse && this._isMouseAtLastSuggestion()) {
      // Add the hyperclick markers if there's a new suggestion and it's under the mouse.
      this._updateNavigationMarkers(this._lastSuggestionAtMouse.range);
    } else {
      // Remove all the markers if we've finished loading and there's no suggestion.
      this._updateNavigationMarkers(null);
    }
  }

  _getMousePositionAsBufferPosition(): atom$Point {
    const {component} = this._textEditorView;
    invariant(component);
    invariant(this._lastMouseEvent);
    const screenPosition = component.screenPositionForMouseEvent(
      this._lastMouseEvent,
    );
    try {
      return this._textEditor.bufferPositionForScreenPosition(screenPosition);
    } catch (error) {
      // Fix https://github.com/facebook/nuclide/issues/292
      // When navigating Atom workspace with `CMD/CTRL` down,
      // it triggers TextEditorElement's `mousemove` with invalid screen position.
      // This falls back to returning the start of the editor.
      getLogger('hyperclick').error(
        'Hyperclick: Error getting buffer position for screen position:',
        error,
      );
      return new Point(0, 0);
    }
  }

  _isMouseAtLastSuggestion(): boolean {
    if (!this._lastSuggestionAtMouse) {
      return false;
    }
    const {range} = this._lastSuggestionAtMouse;
    invariant(range, 'Hyperclick result must have a valid Range');
    return isPositionInRange(this._getMousePositionAsBufferPosition(), range);
  }

  _isMouseAtLastWordRange(): boolean {
    const lastWordRange = this._lastWordRange;
    if (lastWordRange == null) {
      return false;
    }
    return isPositionInRange(
      this._getMousePositionAsBufferPosition(),
      lastWordRange,
    );
  }

  _clearSuggestion(): void {
    this._doneLoading();
    this._lastSuggestionAtMousePromise = null;
    this._lastSuggestionAtMouse = null;
    this._updateNavigationMarkers(null);
  }

  async _confirmSuggestionAtCursor(): Promise<void> {
    const suggestion = await this._hyperclick.getSuggestion(
      this._textEditor,
      this._textEditor.getCursorBufferPosition(),
    );
    if (suggestion) {
      this._confirmSuggestion(suggestion);
    }
  }

  /**
   * Add markers for the given range(s), or clears them if `ranges` is null.
   */
  _updateNavigationMarkers(range: ?(atom$Range | Array<atom$Range>)): void {
    if (this._navigationMarkers) {
      this._navigationMarkers.forEach(marker => marker.destroy());
      this._navigationMarkers = null;
    }

    // Only change the cursor to a pointer if there is a suggestion ready.
    if (range == null) {
      this._textEditorView.classList.remove('hyperclick');
      return;
    }

    this._textEditorView.classList.add('hyperclick');
    const ranges = Array.isArray(range) ? range : [range];
    this._navigationMarkers = ranges.map(markerRange => {
      const marker = this._textEditor.markBufferRange(markerRange, {
        invalidate: 'never',
      });
      this._textEditor.decorateMarker(marker, {
        type: 'highlight',
        class: 'hyperclick',
      });
      return marker;
    });
  }

  /**
   * Returns whether an event should be handled by hyperclick or not.
   */
  _isHyperclickEvent(event: SyntheticKeyboardEvent | MouseEvent): boolean {
    return (
      event.shiftKey === this._triggerKeys.has('shiftKey') &&
      event.ctrlKey === this._triggerKeys.has('ctrlKey') &&
      event.altKey === this._triggerKeys.has('altKey') &&
      event.metaKey === this._triggerKeys.has('metaKey')
    );
  }

  _doneLoading(): void {
    this._isLoading = false;
    this._textEditorView.classList.remove('hyperclick-loading');
  }

  dispose() {
    this._isDestroyed = true;
    this._clearSuggestion();
    this._textEditorView.removeEventListener('keydown', this._onKeyDown);
    this._textEditorView.removeEventListener('keyup', this._onKeyUp);
    this._textEditorView.removeEventListener(
      'contextmenu',
      this._onContextMenu,
    );
    this._subscriptions.dispose();
  }
}

/**
 * Determine whether the specified event will trigger Atom's multiple cursors. This is based on (and
 * must be the same as!) [Atom's
 * logic](https://github.com/atom/atom/blob/v1.14.2/src/text-editor-component.coffee#L527).
 */
function isMulticursorEvent(event: MouseEvent): boolean {
  const {platform} = process;
  const isLeftButton =
    event.button === 0 || (event.button === 1 && platform === 'linux');
  const {metaKey, ctrlKey} = event;

  if (!isLeftButton) {
    return false;
  }
  if (ctrlKey && platform === 'darwin') {
    return false;
  }

  return metaKey || (ctrlKey && platform !== 'darwin');
}
