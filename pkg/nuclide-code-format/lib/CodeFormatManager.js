'use babel';
/* @flow */

/*
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 */

import type {CodeFormatProvider} from './types';

import {CompositeDisposable, Range} from 'atom';
import {getFormatOnSave} from './config';

export default class CodeFormatManager {

  _subscriptions: ?CompositeDisposable;
  _codeFormatProviders: Array<CodeFormatProvider>;
  _pendingFormats: Map<atom$TextEditor, boolean>;

  constructor() {
    const subscriptions = this._subscriptions = new CompositeDisposable();
    subscriptions.add(atom.commands.add(
      'atom-text-editor',
      'nuclide-code-format:format-code',
      // Atom doesn't accept in-command modification of the text editor contents.
      () => process.nextTick(this._formatCodeInActiveTextEditor.bind(this)),
    ));
    subscriptions.add(atom.workspace.observeTextEditors(this._addEditor.bind(this)));
    this._codeFormatProviders = [];
    this._pendingFormats = new Map();
  }

  _addEditor(editor: atom$TextEditor): void {
    if (!this._subscriptions) {
      return;
    }

    this._subscriptions.add(editor.getBuffer().onDidSave(async () => {
      if (getFormatOnSave() && !this._pendingFormats.get(editor)) {
        // Because formatting code is async, we need to resave the file once
        // we're done formatting, but prevent resaving from retriggering the
        // onDidSave callback, which would be an infinite cycle.
        this._pendingFormats.set(editor, true);
        try {
          const didFormat = await this._formatCodeInTextEditor(editor, false);
          if (didFormat) {
            // TextEditor.save is synchronous for local files, but our custom
            // NuclideTextBuffer.saveAs implementation is asynchronous.
            await editor.save();
          }
        } finally {
          this._pendingFormats.delete(editor);
        }
      }
    }));

    editor.onDidDestroy(() => {
      this._pendingFormats.delete(editor);
    });
  }

  // Checks whether contents are same in the buffer post-format, throwing if
  // anything has changed.
  _checkContentsAreSame(before: string, after: string): void {
    if (before !== after) {
      throw new Error('The file contents were changed before formatting was complete.');
    }
  }

  // Formats code in the active editor, returning whether or not the code
  // formatted successfully.
  async _formatCodeInActiveTextEditor(): Promise<boolean> {
    const editor = atom.workspace.getActiveTextEditor();
    if (!editor) {
      atom.notifications.addError('No active text editor to format its code!');
      return false;
    }

    return await this._formatCodeInTextEditor(editor);
  }

  // Formats code in the editor specified, returning whether or not the code
  // formatted successfully.
  async _formatCodeInTextEditor(
    editor: atom$TextEditor,
    displayErrors: boolean = true,
  ): Promise<boolean> {
    const {scopeName} = editor.getGrammar();
    const matchingProviders = this._getMatchingProvidersForScopeName(scopeName);

    if (!matchingProviders.length) {
      if (displayErrors) {
        atom.notifications.addError('No Code-Format providers registered for scope: ' + scopeName);
      }
      return false;
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
    const contents = editor.getText();

    try {
      const provider = matchingProviders[0];
      if (provider.formatCode != null &&
        (!selectionRangeEmpty || provider.formatEntireFile == null)) {
        const formatted = await provider.formatCode(editor, formatRange);
        // Throws if contents have changed since the time of triggering format code.
        this._checkContentsAreSame(contents, editor.getText());

        if (selectionRangeEmpty) {
          buffer.setTextViaDiff(formatted);
        } else {
          editor.setTextInBufferRange(formatRange, formatted);
        }
        return true;
      } else if (provider.formatEntireFile != null) {
        const {newCursor, formatted} = await provider.formatEntireFile(editor, formatRange);
        // Throws if contents have changed since the time of triggering format code.
        this._checkContentsAreSame(contents, editor.getText());

        buffer.setTextViaDiff(formatted);

        const newPosition = (newCursor != null)
          ? buffer.positionForCharacterIndex(newCursor)
          : editor.getCursorBufferPosition();

        // We call setCursorBufferPosition even when there is no newCursor,
        // because it unselects the text selection.
        editor.setCursorBufferPosition(newPosition);
        return true;
      } else {
        throw new Error('code-format providers must implement formatCode or formatEntireFile');
      }
    } catch (e) {
      if (displayErrors) {
        atom.notifications.addError('Failed to format code: ' + e.message);
      }
      return false;
    }
  }

  _getMatchingProvidersForScopeName(scopeName: string): Array<CodeFormatProvider> {
    const matchingProviders = this._codeFormatProviders.filter(provider => {
      const providerGrammars = provider.selector.split(/, ?/);
      return provider.inclusionPriority > 0 && providerGrammars.indexOf(scopeName) !== -1;
    });
    return matchingProviders.sort((providerA, providerB) => {
      // $FlowFixMe a comparator function should return a number
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
    this._pendingFormats.clear();
  }
}
