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

import type {HyperclickSuggestion} from './types';

import invariant from 'assert';
import SuggestionListElement from './SuggestionListElement';

export default class SuggestionList {
  _element: ?SuggestionListElement;
  _textEditor: atom$TextEditor;
  _suggestion: HyperclickSuggestion;
  _suggestionMarker: ?atom$Marker;
  _overlayDecoration: ?atom$Decoration;

  getElement(): SuggestionListElement {
    if (this._element == null) {
      this._element = new SuggestionListElement().initialize(this);
    }
    return this._element;
  }

  show(textEditor: atom$TextEditor, suggestion: HyperclickSuggestion): void {
    if (!textEditor || !suggestion) {
      return;
    }

    this._textEditor = textEditor;
    this._suggestion = suggestion;

    this.hide();

    const {range} = suggestion;
    invariant(range);
    const {start: position} = Array.isArray(range) ? range[0] : range;
    this._suggestionMarker = textEditor.markBufferPosition(position);
    if (this._suggestionMarker) {
      this._overlayDecoration = textEditor.decorateMarker(
        this._suggestionMarker,
        {
          type: 'overlay',
          item: this,
        },
      );
    }
  }

  hide() {
    // $FlowFixMe method override not working with `this`.
    atom.views.getView(this).dispose();
    if (this._suggestionMarker) {
      this._suggestionMarker.destroy();
    } else if (this._overlayDecoration) {
      this._overlayDecoration.destroy();
    }
    this._suggestionMarker = undefined;
    this._overlayDecoration = undefined;
  }

  getTextEditor(): ?TextEditor {
    return this._textEditor;
  }

  getSuggestion(): ?HyperclickSuggestion {
    return this._suggestion;
  }
}
