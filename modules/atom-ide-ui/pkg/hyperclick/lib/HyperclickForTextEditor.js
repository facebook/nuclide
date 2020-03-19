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

import {Point} from 'atom';
import featureConfig from 'nuclide-commons-atom/feature-config';
import {wordAtPosition} from 'nuclide-commons-atom/range';
import {isPositionInRange} from 'nuclide-commons/range';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import showTriggerConflictWarning from './showTriggerConflictWarning';
import invariant from 'assert';
import {Subject, Observable} from 'rxjs';

import {getLogger} from 'log4js';

const WARN_ABOUT_TRIGGER_CONFLICT_KEY = 'hyperclick.warnAboutTriggerConflict';
const LOADING_DELAY = 250;

/**
 * Construct this object to enable Hyperclick in a text editor.
 * Call `dispose` to disable the feature.
 */
export default class HyperclickForTextEditor {
  _textEditor: atom$TextEditor;
  _textEditorView: atom$TextEditorElement;
  _getSuggestion: (
    textEditor: TextEditor,
    position: atom$Point,
  ) => Promise<?HyperclickSuggestion>;
  _showSuggestionList: (
    textEditor: TextEditor,
    suggestion: HyperclickSuggestion,
  ) => void;
  _lastMouseEvent: ?MouseEvent = null;
  // Cache the most recent suggestion so we can avoid unnecessary fetching.
  _lastSuggestionAtMouse: ?HyperclickSuggestion = null;
  _navigationMarkers: ?Array<atom$Marker> = null;
  _lastWordRange: ?atom$Range = null;
  _subscriptions: UniversalDisposable = new UniversalDisposable();
  _isDestroyed: boolean = false;
  _loadingTimer: ?number;
  _triggerKeys: Set<'shiftKey' | 'ctrlKey' | 'altKey' | 'metaKey'>;

  // A central "event bus" for all fetch events.
  // TODO: Rx-ify all incoming events to avoid using a subject.
  _fetchStream: Subject<?MouseEvent> = new Subject();
  // Stored for testing.
  _suggestionStream: Observable<?HyperclickSuggestion>;

  constructor(
    textEditor: atom$TextEditor,
    getSuggestion: (
      textEditor: TextEditor,
      position: atom$Point,
    ) => Promise<?HyperclickSuggestion>,
    showSuggestionList: (
      textEditor: TextEditor,
      suggestion: HyperclickSuggestion,
    ) => void,
  ) {
    this._textEditor = textEditor;
    this._getSuggestion = getSuggestion;
    this._showSuggestionList = showSuggestionList;
    this._textEditorView = atom.views.getView(textEditor);
    this._setupMouseListeners();

    this._textEditorView.addEventListener('keydown', this._onKeyDown);
    this._textEditorView.addEventListener('keyup', this._onKeyUp);
    this._textEditorView.addEventListener('contextmenu', this._onContextMenu);

    this._subscriptions.add(
      atom.commands.add(this._textEditorView, {
        'hyperclick:confirm-cursor': () => this._confirmSuggestionAtCursor(),
      }),
    );

    this._suggestionStream = this._observeSuggestions().share();

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
      this._suggestionStream.subscribe(suggestion =>
        this._updateSuggestion(suggestion),
      ),
    );
  }

  _setupMouseListeners(): void {
    const addMouseListeners = () => {
      const {component} = this._textEditorView;
      invariant(component);
      const linesDomNode = component.refs.lineTiles;
      if (linesDomNode == null) {
        return;
      }
      linesDomNode.addEventListener('mousedown', this._onMouseDown);
      linesDomNode.addEventListener('mousemove', this._onMouseMove);
      const removalDisposable = new UniversalDisposable(() => {
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
      this._showSuggestionList(this._textEditor, suggestion);
    } else {
      invariant(typeof suggestion.callback === 'function');
      suggestion.callback();
    }
  }

  _onContextMenu = (mouseEvent: MouseEvent): void => {
    // If the key trigger happens to cause the context menu to show up, then
    // cancel it. By this point, it's too late to know if you're at a suggestion
    // position to be more fine grained. So if your trigger keys are "ctrl+cmd",
    // then you can't use that combination to bring up the context menu.
    if (this._isHyperclickEvent(mouseEvent)) {
      mouseEvent.stopPropagation();
    }
  };

  _onMouseMove = (mouseEvent: MouseEvent): void => {
    // We save the last `MouseEvent` so the user can trigger Hyperclick by
    // pressing the key without moving the mouse again. We only save the
    // relevant properties to prevent retaining a reference to the event.
    this._lastMouseEvent = ({
      clientX: mouseEvent.clientX,
      clientY: mouseEvent.clientY,
    }: any);

    if (this._isHyperclickEvent(mouseEvent)) {
      this._fetchStream.next(mouseEvent);
    } else {
      this._clearSuggestion();
    }
  };

  _onMouseDown = (mouseEvent: MouseEvent): void => {
    if (!this._isHyperclickEvent(mouseEvent)) {
      return;
    }

    // If hyperclick and multicursor are using the same trigger, prevent multicursor.
    if (isMulticursorEvent(mouseEvent)) {
      mouseEvent.stopPropagation();
      if (localStorage.getItem(WARN_ABOUT_TRIGGER_CONFLICT_KEY) !== 'false') {
        localStorage.setItem(WARN_ABOUT_TRIGGER_CONFLICT_KEY, 'false');
        showTriggerConflictWarning();
      }
    }

    if (this._lastMouseEvent == null) {
      return;
    }
    const lastPosition = this._getMousePositionAsBufferPosition(
      this._lastMouseEvent,
    );
    if (lastPosition == null || !this._isInLastSuggestion(lastPosition)) {
      return;
    }

    if (this._lastSuggestionAtMouse) {
      const lastSuggestionAtMouse = this._lastSuggestionAtMouse;
      // Move the cursor to the click location to force a navigation-stack push.
      this._textEditor.setCursorBufferPosition(lastPosition);

      this._confirmSuggestion(lastSuggestionAtMouse);
      // Prevent the <meta-click> event from adding another cursor.
      mouseEvent.stopPropagation();
    }

    this._clearSuggestion();
  };

  _onKeyDown = (event: KeyboardEvent): void => {
    // Show the suggestion at the last known mouse position.
    if (this._isHyperclickEvent(event) && this._lastMouseEvent != null) {
      this._fetchStream.next(this._lastMouseEvent);
    }
  };

  _onKeyUp = (event: KeyboardEvent): void => {
    if (!this._isHyperclickEvent(event)) {
      this._clearSuggestion();
    }
  };

  /**
   * Returns a `Promise` that's resolved when the latest suggestion's available.
   * (Exposed for testing.)
   */
  getSuggestionAtMouse(): Promise<?HyperclickSuggestion> {
    return this._suggestionStream.take(1).toPromise();
  }

  _observeSuggestions(): Observable<?HyperclickSuggestion> {
    return this._fetchStream
      .map(mouseEvent => {
        if (mouseEvent == null) {
          return null;
        }
        return this._getMousePositionAsBufferPosition(mouseEvent);
      })
      .distinctUntilChanged((x, y) => {
        if (x == null || y == null) {
          return (x == null) === (y == null);
        }
        return x.compare(y) === 0;
      })
      .filter(position => {
        if (position == null) {
          return true;
        }

        // Don't fetch suggestions if the mouse is still in the same 'word', where
        // 'word' is defined by the wordRegExp at the current position.
        //
        // If the last suggestion had multiple ranges, we have no choice but to
        // fetch suggestions because the new word might be between those ranges.
        // This should be ok because it will reuse that last suggestion until the
        // mouse moves off of it.
        if (
          (this._lastSuggestionAtMouse == null ||
            !Array.isArray(this._lastSuggestionAtMouse.range)) &&
          this._isInLastWordRange(position)
        ) {
          return false;
        }

        // Don't refetch if we're already inside the previously emitted suggestion.
        if (this._isInLastSuggestion(position)) {
          return false;
        }

        return true;
      })
      .do(position => {
        if (position == null) {
          this._lastWordRange = null;
        } else {
          const match = wordAtPosition(this._textEditor, position);
          this._lastWordRange = match != null ? match.range : null;
        }
      })
      .switchMap(position => {
        if (position == null) {
          return Observable.of(null);
        }

        return Observable.using(
          () => this._showLoading(),
          () =>
            Observable.defer(() =>
              this._getSuggestion(this._textEditor, position),
            )
              .startWith(null) // Clear the previous suggestion immediately.
              .catch(e => {
                getLogger('hyperclick').error(
                  'Error getting Hyperclick suggestion:',
                  e,
                );
                return Observable.of(null);
              }),
        );
      })
      .distinctUntilChanged();
  }

  _updateSuggestion(suggestion: ?HyperclickSuggestion): void {
    this._lastSuggestionAtMouse = suggestion;
    if (suggestion != null) {
      // Add the hyperclick markers if there's a new suggestion and it's under the mouse.
      this._updateNavigationMarkers(suggestion.range);
    } else {
      // Remove all the markers if we've finished loading and there's no suggestion.
      this._updateNavigationMarkers(null);
    }
  }

  _getMousePositionAsBufferPosition(mouseEvent: MouseEvent): ?atom$Point {
    const {component} = this._textEditorView;
    invariant(component);
    const screenPosition = component.screenPositionForMouseEvent(mouseEvent);
    const screenLine = this._textEditor.lineTextForScreenRow(
      screenPosition.row,
    );
    if (screenPosition.column >= screenLine.length) {
      // We shouldn't try to fetch suggestions for trailing whitespace.
      return null;
    }
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

  _isInLastSuggestion(position: atom$Point): boolean {
    if (!this._lastSuggestionAtMouse) {
      return false;
    }
    const {range} = this._lastSuggestionAtMouse;
    return isPositionInRange(position, range);
  }

  _isInLastWordRange(position: atom$Point): boolean {
    const lastWordRange = this._lastWordRange;
    if (lastWordRange == null) {
      return false;
    }
    return isPositionInRange(position, lastWordRange);
  }

  _clearSuggestion(): void {
    this._fetchStream.next(null);
  }

  async _confirmSuggestionAtCursor(): Promise<void> {
    const suggestion = await this._getSuggestion(
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
  _isHyperclickEvent(event: KeyboardEvent | MouseEvent): boolean {
    return (
      event.shiftKey === this._triggerKeys.has('shiftKey') &&
      event.ctrlKey === this._triggerKeys.has('ctrlKey') &&
      event.altKey === this._triggerKeys.has('altKey') &&
      event.metaKey === this._triggerKeys.has('metaKey')
    );
  }

  // A subscription that encapsulates the cursor loading spinner.
  // There should only be one subscription active at a given time!
  _showLoading(): rxjs$Subscription {
    return Observable.timer(LOADING_DELAY)
      .switchMap(() =>
        Observable.create(() => {
          this._textEditorView.classList.add('hyperclick-loading');
          return () => {
            this._textEditorView.classList.remove('hyperclick-loading');
          };
        }),
      )
      .subscribe();
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
