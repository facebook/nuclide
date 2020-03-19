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

import {Emitter} from 'atom';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';

const GRAMMAR_CHANGE_EVENT = 'grammar-change';

/**
 * A singleton that listens to grammar changes in all text editors.
 */
class GrammarForTextEditorsListener {
  _emitter: Emitter;
  _subscriptions: UniversalDisposable;

  constructor() {
    this._emitter = new Emitter();
    this._subscriptions = new UniversalDisposable();
    this._subscriptions.add(
      this._emitter,
      atom.workspace.observeTextEditors(textEditor => {
        this._subscriptions.addUntilDestroyed(
          textEditor,
          textEditor.observeGrammar(grammar => {
            this._emitter.emit(GRAMMAR_CHANGE_EVENT, textEditor);
          }),
        );
      }),
    );
  }

  observeGrammarForTextEditors(
    fn: (textEditor: TextEditor, grammar: atom$Grammar) => void,
  ): IDisposable {
    function fnWithGrammar(textEditor) {
      fn(textEditor, textEditor.getGrammar());
    }

    // The event was already handled before `fn` was added to the emitter, so
    // we need to call it on all the existing editors.
    atom.workspace.getTextEditors().forEach(fnWithGrammar);
    return this._emitter.on(GRAMMAR_CHANGE_EVENT, fnWithGrammar);
  }

  dispose(): void {
    this._subscriptions.dispose();
  }
}

let grammarForTextEditorsListener: ?GrammarForTextEditorsListener;

/**
 * Use this to perform an action on every text editor with its latest grammar.
 *
 * @param fn This is called once for every text editor, and then again every
 * time it changes to a grammar.
 */
export default function observeGrammarForTextEditors(
  fn: (textEditor: TextEditor, grammar: atom$Grammar) => void,
): IDisposable {
  if (!grammarForTextEditorsListener) {
    grammarForTextEditorsListener = new GrammarForTextEditorsListener();
  }
  return grammarForTextEditorsListener.observeGrammarForTextEditors(fn);
}

if (atom.inSpecMode()) {
  observeGrammarForTextEditors.__reset__ = function() {
    if (grammarForTextEditorsListener) {
      grammarForTextEditorsListener.dispose();
      grammarForTextEditorsListener = null;
    }
  };
}
