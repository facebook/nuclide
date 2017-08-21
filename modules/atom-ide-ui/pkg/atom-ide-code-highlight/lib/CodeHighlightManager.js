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
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import {observeActiveEditorsDebounced} from 'nuclide-commons-atom/debounced';

const HIGHLIGHT_DELAY_MS = 250;

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
      .switchMap(editor => {
        if (editor == null) {
          return Observable.empty();
        }
        const changeCursorEvents = observableFromSubscribeFunction(
          editor.onDidChangeCursorPosition.bind(editor),
        )
          .map(event => event.newBufferPosition)
          .filter(
            // If we're moving around inside highlighted ranges, that's fine.
            position => !this._isPositionInHighlightedRanges(editor, position),
          );

        const changeEvents = observableFromSubscribeFunction(
          editor.onDidChange.bind(editor),
        )
          // Ensure we start highlighting immediately.
          .startWith(null)
          .map(() => editor.getCursorBufferPosition());

        const destroyEvents = observableFromSubscribeFunction(
          editor.onDidDestroy.bind(editor),
        );

        return (
          Observable.merge(changeCursorEvents, changeEvents)
            // Destroy old markers immediately - never show stale results.
            .do(() => this._destroyMarkers())
            .switchMap(position => {
              return Observable.timer(
                HIGHLIGHT_DELAY_MS,
              ).switchMap(async () => {
                return {
                  editor,
                  ranges: await this._getHighlightedRanges(editor, position),
                };
              });
            })
            .takeUntil(destroyEvents)
        );
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
    const provider = this._providers.getProviderForEditor(editor);
    if (!provider) {
      return null;
    }

    try {
      return await provider.highlight(editor, position);
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
        class: 'atom-ide-code-highlight-marker',
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
