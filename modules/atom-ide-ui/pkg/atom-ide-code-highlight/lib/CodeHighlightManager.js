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

import type {CodeHighlightProvider} from './types';

import {getLogger} from 'log4js';
import {Observable} from 'rxjs';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {fastDebounce, toggle} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import {observeActiveEditorsDebounced} from 'nuclide-commons-atom/debounced';

const CURSOR_DELAY_MS = 250;
// Apply a much higher debounce to text changes to avoid disrupting the typing experience.
const CHANGE_TOGGLE_MS = 2500;

export default class CodeHighlightManager {
  _subscriptions: UniversalDisposable;
  _providers: ProviderRegistry<CodeHighlightProvider>;
  _markers: Array<atom$Marker>;

  constructor() {
    this._providers = new ProviderRegistry();
    this._markers = [];
    this._subscriptions = new UniversalDisposable(this._highlightEditors());
  }

  _highlightEditors(): rxjs$Subscription {
    return observeActiveEditorsDebounced(0)
      .do(() => this._destroyMarkers())
      .switchMap(editor => {
        if (editor == null) {
          return Observable.empty();
        }
        const cursorPositions = observableFromSubscribeFunction(
          editor.onDidChangeCursorPosition.bind(editor),
        )
          .filter(
            // If we're moving around inside highlighted ranges, that's fine.
            event =>
              !this._isPositionInHighlightedRanges(
                editor,
                event.newBufferPosition,
              ),
          )
          .do(() => this._destroyMarkers()) // Immediately clear previous markers.
          .let(fastDebounce(CURSOR_DELAY_MS))
          .startWith((null: any)) // Immediately kick off a highlight event.
          .map(() => editor.getCursorBufferPosition());

        // Changing text triggers a CHANGE_TOGGLE_MS period in which cursor changes are ignored.
        // We'll model this as one stream that emits 'false' and another that debounces 'true's.
        const changeEvents = observableFromSubscribeFunction(
          editor.onDidChange.bind(editor),
        )
          .do(() => this._destroyMarkers())
          .share();

        const changeToggles = Observable.merge(
          Observable.of(true),
          changeEvents.mapTo(false),
          changeEvents.let(fastDebounce(CHANGE_TOGGLE_MS)).mapTo(true),
        );

        const destroyEvents = observableFromSubscribeFunction(
          editor.onDidDestroy.bind(editor),
        );

        return cursorPositions
          .let(toggle(changeToggles))
          .switchMap(async position => {
            return {
              editor,
              ranges: await this._getHighlightedRanges(editor, position),
            };
          })
          .takeUntil(destroyEvents);
      })
      .subscribe(({editor, ranges}) => {
        if (ranges != null) {
          this._highlightRanges(editor, ranges);
        }
      });
  }

  async _getHighlightedRanges(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    const providers = Array.from(
      this._providers.getAllProvidersForEditor(editor),
    );
    try {
      const highlights = await Promise.all(
        providers.map(p => p.highlight(editor, position)),
      );
      return highlights.find(h => h != null && h.length > 0);
    } catch (e) {
      getLogger('code-highlight').error('Error getting code highlights', e);
      return null;
    }
  }

  _highlightRanges(editor: atom$TextEditor, ranges: Array<atom$Range>): void {
    this._destroyMarkers();
    this._markers = ranges.map(range => editor.markBufferRange(range, {}));
    this._markers.forEach(marker => {
      editor.decorateMarker(marker, {
        type: 'highlight',
        class: 'code-highlight-marker',
      });
    });
  }

  _isPositionInHighlightedRanges(
    editor: atom$TextEditor,
    position: atom$Point,
  ): boolean {
    return this._markers
      .map(marker => marker.getBufferRange())
      .some(range => range.containsPoint(position));
  }

  _destroyMarkers(): void {
    this._markers.splice(0).forEach(marker => marker.destroy());
  }

  addProvider(provider: CodeHighlightProvider): IDisposable {
    return this._providers.addProvider(provider);
  }

  dispose() {
    this._subscriptions.dispose();
    this._destroyMarkers();
  }
}
