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

import type {HyperclickSuggestion, HyperclickProvider} from './types';

import HyperclickForTextEditor from './HyperclickForTextEditor';
import SuggestionList from './SuggestionList';

import invariant from 'assert';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import {observeTextEditors} from 'nuclide-commons-atom/text-editor';
import {wordAtPosition} from 'nuclide-commons-atom/range';

/**
 * Construct this object to enable Hyperclick in the Atom workspace.
 * Call `dispose` to disable the feature.
 */
export default class Hyperclick {
  _providers: ProviderRegistry<HyperclickProvider>;
  _suggestionList: SuggestionList;
  _hyperclickForTextEditors: Set<HyperclickForTextEditor>;
  _textEditorSubscription: IDisposable;

  constructor() {
    this._providers = new ProviderRegistry();

    this._suggestionList = new SuggestionList();
    this._hyperclickForTextEditors = new Set();
    this._textEditorSubscription = observeTextEditors(
      this.observeTextEditor.bind(this),
    );
  }

  observeTextEditor(textEditor: TextEditor): IDisposable {
    const hyperclickForTextEditor = new HyperclickForTextEditor(
      textEditor,
      this,
    );
    this._hyperclickForTextEditors.add(hyperclickForTextEditor);
    const disposable = new UniversalDisposable(() => {
      hyperclickForTextEditor.dispose();
      this._hyperclickForTextEditors.delete(hyperclickForTextEditor);
    });
    return new UniversalDisposable(
      textEditor.onDidDestroy(() => disposable.dispose()),
      disposable,
    );
  }

  dispose() {
    this._suggestionList.hide();
    this._textEditorSubscription.dispose();
    this._hyperclickForTextEditors.forEach(hyperclick => hyperclick.dispose());
    this._hyperclickForTextEditors.clear();
  }

  addProvider(
    provider: HyperclickProvider | Array<HyperclickProvider>,
  ): IDisposable {
    if (Array.isArray(provider)) {
      return new UniversalDisposable(
        ...provider.map(p => this._providers.addProvider(p)),
      );
    }
    return this._providers.addProvider(provider);
  }

  /**
   * Returns the first suggestion from the consumed providers.
   */
  async getSuggestion(
    textEditor: TextEditor,
    position: atom$Point,
  ): Promise<?HyperclickSuggestion> {
    for (const provider of this._providers.getAllProvidersForEditor(
      textEditor,
    )) {
      let result;
      if (provider.getSuggestion) {
        // eslint-disable-next-line no-await-in-loop
        result = await provider.getSuggestion(textEditor, position);
      } else if (provider.getSuggestionForWord) {
        const match = wordAtPosition(textEditor, position, provider.wordRegExp);
        if (match == null) {
          continue;
        }
        const {wordMatch, range} = match;
        invariant(provider.getSuggestionForWord);
        // eslint-disable-next-line no-await-in-loop
        result = await provider.getSuggestionForWord(
          textEditor,
          wordMatch[0],
          range,
        );
      } else {
        throw new Error(
          'Hyperclick must have either `getSuggestion` or `getSuggestionForWord`',
        );
      }
      if (result != null) {
        return result;
      }
    }
  }

  showSuggestionList(
    textEditor: TextEditor,
    suggestion: HyperclickSuggestion,
  ): void {
    this._suggestionList.show(textEditor, suggestion);
  }
}
