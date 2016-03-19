'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import {Range} from 'atom';
const {CompositeDisposable} = require('atom');

import type {CodeFormatProvider} from './types';

class CodeFormatManager {

  _subscriptions: ?CompositeDisposable;
  _codeFormatProviders: Array<CodeFormatProvider>;

  constructor() {
    const subscriptions = this._subscriptions = new CompositeDisposable();
    subscriptions.add(atom.commands.add(
      'atom-text-editor',
      'nuclide-code-format:format-code',
      // Atom doesn't accept in-command modification of the text editor contents.
      () => process.nextTick(this._formatCodeInActiveTextEditor.bind(this))
    ));
    this._codeFormatProviders = [];
  }

  async _formatCodeInActiveTextEditor(): Promise {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      atom.notifications.addError('No active text editor to format its code!');
      return;
    }

    const {scopeName} = editor.getGrammar();
    const matchingProviders = this._getMatchingProvidersForScopeName(scopeName);

    if (!matchingProviders.length) {
      atom.notifications.addError('No Code-Format providers registered for scope: ' + scopeName);
      return;
    }

    const buffer = editor.getBuffer();
    const selectionRange = editor.getSelectedBufferRange();
    const {start: selectionStart, end: selectionEnd} = selectionRange;
    let formatRange = null;
    const selectionRangeEmpty = selectionRange.isEmpty();
    if (selectionRangeEmpty) {
      // If no selection is done, then, the whole file is wanted to be formatted.
      formatRange = buffer.getRange();
    } else {
      // Format selections should start at the begining of the line,
      // and include the last selected line end.
      formatRange = new Range(
          [selectionStart.row, 0],
          [selectionEnd.row + 1, 0],
      );
    }

    const provider = matchingProviders[0];
    if (provider.formatCode != null &&
      (!selectionRangeEmpty || provider.formatEntireFile == null)) {
      const codeReplacement = await provider.formatCode(editor, formatRange);
      // TODO(most): save cursor location.
      editor.setTextInBufferRange(formatRange, codeReplacement);
    } else if (provider.formatEntireFile != null) {
      const {newCursor, formatted} = await provider.formatEntireFile(editor, formatRange);
      buffer.setTextViaDiff(formatted);
      editor.setCursorBufferPosition(buffer.positionForCharacterIndex(newCursor));
    } else {
      throw new Error('code-format providers must implement formatCode or formatEntireFile');
    }
  }

  _getMatchingProvidersForScopeName(scopeName: string): Array<CodeFormatProvider> {
    const matchingProviders = this._codeFormatProviders.filter(provider => {
      const providerGrammars = provider.selector.split(/, ?/);
      return provider.inclusionPriority > 0 && providerGrammars.indexOf(scopeName) !== -1;
    });
    // $FlowIssue sort doesn't take custom comparator.
    return matchingProviders.sort((providerA, providerB) => {
      return providerA.inclusionPriority < providerB.inclusionPriority;
    });
  }

  addProvider(provider: CodeFormatProvider) {
    this._codeFormatProviders.push(provider);
  }

  dispose() {
    if (this._subscriptions) {
      this._subscriptions.dispose();
      this._subscriptions = null;
    }
    this._codeFormatProviders = [];
  }
}

module.exports = CodeFormatManager;
