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

import type {CodeHighlightProvider} from './types';
import {CompositeDisposable} from 'atom';
import {observeTextEditors} from 'nuclide-commons-atom/text-editor';
import debounce from 'nuclide-commons/debounce';

const HIGHLIGHT_DELAY_MS = 250;

export default class CodeHighlightManager {
  _subscriptions: ?CompositeDisposable;
  _providers: Array<CodeHighlightProvider>;
  _markers: Array<atom$Marker>;

  constructor() {
    this._providers = [];
    this._markers = [];
    const subscriptions = (this._subscriptions = new CompositeDisposable());
    const debouncedCallback = debounce(
      this._onCursorMove.bind(this),
      HIGHLIGHT_DELAY_MS,
      false,
    );
    subscriptions.add(
      observeTextEditors(editor => {
        const editorSubscriptions = new CompositeDisposable();
        editorSubscriptions.add(
          editor.onDidChangeCursorPosition(event => {
            debouncedCallback(editor, event.newBufferPosition);
          }),
        );
        editorSubscriptions.add(
          editor.onDidChange(event => {
            this._destroyMarkers();
            debouncedCallback(editor, editor.getCursorBufferPosition());
          }),
        );
        editorSubscriptions.add(
          editor.onDidDestroy(() => {
            editorSubscriptions.dispose();
            subscriptions.remove(editorSubscriptions);
          }),
        );
        subscriptions.add(editorSubscriptions);
      }),
    );
  }

  async _onCursorMove(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<void> {
    if (editor.isDestroyed() || this._isPositionInHighlightedRanges(position)) {
      return;
    }

    // The cursor is outside the old markers, so they are now stale
    this._destroyMarkers();

    const originalChangeCount = editor.getBuffer().changeCount;
    const highlightedRanges = await this._getHighlightedRanges(
      editor,
      position,
    );
    if (highlightedRanges == null) {
      return;
    }

    // If the cursor has moved, or the file was edited
    // the highlighted ranges we just computed are useless, so abort
    if (this._hasEditorChanged(editor, position, originalChangeCount)) {
      return;
    }

    this._markers = highlightedRanges.map(range =>
      editor.markBufferRange(range, {}),
    );
    this._markers.forEach(marker => {
      editor.decorateMarker(marker, {
        type: 'highlight',
        class: 'nuclide-code-highlight-marker',
      });
    });
  }

  async _getHighlightedRanges(
    editor: atom$TextEditor,
    position: atom$Point,
  ): Promise<?Array<atom$Range>> {
    const {scopeName} = editor.getGrammar();
    const [provider] = this._getMatchingProvidersForScopeName(scopeName);
    if (!provider) {
      return null;
    }

    return provider.highlight(editor, position);
  }

  _hasEditorChanged(
    editor: atom$TextEditor,
    position: atom$Point,
    originalChangeCount: number,
  ): boolean {
    return (
      !editor.getCursorBufferPosition().isEqual(position) ||
      editor.getBuffer().changeCount !== originalChangeCount
    );
  }

  _isPositionInHighlightedRanges(position: atom$Point): boolean {
    return this._markers
      .map(marker => marker.getBufferRange())
      .some(range => range.containsPoint(position));
  }

  _getMatchingProvidersForScopeName(
    scopeName: string,
  ): Array<CodeHighlightProvider> {
    const matchingProviders = this._providers.filter(provider => {
      const providerGrammars = provider.selector.split(/, ?/);
      return (
        provider.inclusionPriority > 0 &&
        providerGrammars.indexOf(scopeName) !== -1
      );
    });
    return matchingProviders.sort((providerA, providerB) => {
      return providerB.inclusionPriority - providerA.inclusionPriority;
    });
  }

  _destroyMarkers(): void {
    this._markers.splice(0).forEach(marker => marker.destroy());
  }

  addProvider(provider: CodeHighlightProvider) {
    this._providers.push(provider);
  }

  dispose() {
    if (this._subscriptions) {
      this._subscriptions.dispose();
      this._subscriptions = null;
    }
    this._providers = [];
    this._markers = [];
  }
}
