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

import {Emitter} from 'atom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import observeGrammarForTextEditors from 'nuclide-commons-atom/observe-grammar-for-text-editors';

const START_OBSERVING_TEXT_EDITOR_EVENT = 'start-observing-text-editor';
const STOP_OBSERVING_TEXT_EDITOR_EVENT = 'stop-observing-text-editor';

/**
 * Use this to perform an action on all text editors of the given grammar set.
 *
 * This exists as its own class to make it possible to reuse instances when
 * multiple callers observe on text editors with the same grammar scopes.
 */
class LanguageTextEditorsListener {
  _grammarScopes: Set<string>;
  _emitter: Emitter;
  _observedTextEditors: Set<TextEditor>;
  _subscriptions: UniversalDisposable;

  constructor(grammarScopes: Set<string>) {
    this._grammarScopes = grammarScopes;

    this._emitter = new Emitter();
    this._observedTextEditors = new Set();

    this._subscriptions = new UniversalDisposable();
    this._subscriptions.add(
      observeGrammarForTextEditors((textEditor, grammar) => {
        const textEditorHasTheRightGrammar = this._grammarScopes.has(
          grammar.scopeName,
        );
        const isTextEditorObserved = this._observedTextEditors.has(textEditor);
        if (textEditorHasTheRightGrammar && !isTextEditorObserved) {
          this._emitter.emit(START_OBSERVING_TEXT_EDITOR_EVENT, textEditor);
          this._observedTextEditors.add(textEditor);
        } else if (!textEditorHasTheRightGrammar && isTextEditorObserved) {
          this._emitter.emit(STOP_OBSERVING_TEXT_EDITOR_EVENT, textEditor);
          this._observedTextEditors.delete(textEditor);
        }

        this._subscriptions.addUntilDestroyed(
          textEditor,
          textEditor.onDidDestroy(() => {
            // When a text editor that we were observing is destroyed, we need to
            // do clean-up even if its grammar hasn't changed.
            if (this._observedTextEditors.has(textEditor)) {
              this._emitter.emit(STOP_OBSERVING_TEXT_EDITOR_EVENT, textEditor);
              this._observedTextEditors.delete(textEditor);
            }
          }),
        );
      }),
    );
  }

  observeLanguageTextEditors(
    fn: (textEditor: TextEditor) => void,
    cleanupFn: (textEditor: TextEditor) => void,
  ): IDisposable {
    // The event was already handled before `fn` was added to the emitter, so
    // we need to call it on all the existing editors.
    atom.workspace
      .getTextEditors()
      .filter(textEditor =>
        this._grammarScopes.has(textEditor.getGrammar().scopeName),
      )
      // We wrap `fn` instead of passing it directly to `.forEach` so it only
      // gets called with one arg (i.e. it matches the Flow annotation).
      .forEach(textEditor => fn(textEditor));

    return new UniversalDisposable(
      this._emitter.on(START_OBSERVING_TEXT_EDITOR_EVENT, fn),
      this._emitter.on(STOP_OBSERVING_TEXT_EDITOR_EVENT, cleanupFn),
    );
  }

  dispose(): void {
    this._emitter.dispose();
    this._observedTextEditors.clear();
    this._subscriptions.dispose();
  }
}

/**
 * Perform actions on text editors of a given language.
 *
 * @param grammarScopes The grammar scope names to watch for.
 * @param fn This is called once on every text editor that matches the grammars.
 * @param cleanupFn This is called when a text editor no longer matches the
 * grammars or is destroyed.
 */
export default function observeLanguageTextEditors(
  grammarScopes: Array<string>,
  fn: (textEditor: TextEditor) => void,
  cleanupFn?: (textEditor: TextEditor) => void,
): IDisposable {
  const subscriptions = new UniversalDisposable();
  const listener = new LanguageTextEditorsListener(new Set(grammarScopes));
  subscriptions.add(listener);
  subscriptions.add(
    listener.observeLanguageTextEditors(fn, cleanupFn || (() => {})),
  );
  return subscriptions;
}
