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

import type {
  CodeFormatProvider,
  RangeCodeFormatProvider,
  FileCodeFormatProvider,
  OnTypeCodeFormatProvider,
  OnSaveCodeFormatProvider,
} from './types';

import {Range} from 'atom';
import {Observable} from 'rxjs';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {nextTick} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {
  observeEditorDestroy,
  observeTextEditors,
} from 'nuclide-commons-atom/text-editor';
import {applyTextEditsToBuffer} from 'nuclide-commons-atom/text-edit';
import {getFormatOnSave, getFormatOnType} from './config';
import {getLogger} from 'log4js';

const logger = getLogger('atom-ide-code-format');

// Save events are critical, so don't allow providers to block them.
const SAVE_TIMEOUT = 2500;

type FormatEvent =
  | {
      type: 'command' | 'save',
      editor: atom$TextEditor,
    }
  | {
      type: 'type',
      editor: atom$TextEditor,
      edit: atom$TextEditEvent,
    };

export default class CodeFormatManager {
  _subscriptions: UniversalDisposable;
  _rangeProviders: Array<RangeCodeFormatProvider> = [];
  _fileProviders: Array<FileCodeFormatProvider> = [];
  _onTypeProviders: Array<OnTypeCodeFormatProvider> = [];
  _onSaveProviders: Array<OnSaveCodeFormatProvider> = [];

  constructor() {
    this._subscriptions = new UniversalDisposable(this._subscribeToEvents());
  }

  /**
   * Subscribe to all formatting events (commands, saves, edits) and dispatch
   * formatters as necessary.
   * By handling all events in a central location, we ensure that no buffer
   * runs into race conditions with simultaneous formatters.
   */
  _subscribeToEvents(): rxjs$Subscription {
    // Events from the explicit Atom command.
    const commandEvents = observableFromSubscribeFunction(callback =>
      atom.commands.add(
        'atom-text-editor',
        'nuclide-code-format:format-code',
        callback,
      ),
    ).switchMap(() => {
      const editor = atom.workspace.getActiveTextEditor();
      if (!editor) {
        return Observable.empty();
      }
      return Observable.of({type: 'command', editor});
    });

    // Events from editor actions (saving, typing).
    const editorEvents = observableFromSubscribeFunction(
      observeTextEditors,
    ).mergeMap(editor => this._getEditorEventStream(editor));

    return (
      Observable.merge(commandEvents, editorEvents)
        // Group events by buffer to prevent simultaneous formatting operations.
        .groupBy(
          event => event.editor.getBuffer(),
          event => event,
          grouped =>
            // $FlowFixMe: add durationSelector to groupBy
            observableFromSubscribeFunction(callback =>
              // $FlowFixMe: add key to GroupedObservable
              grouped.key.onDidDestroy(callback),
            ),
        )
        .mergeMap(events =>
          // Concatenate a null event to ensure that buffer destruction
          // interrupts any pending format operations.
          events.concat(Observable.of(null)).switchMap(event => {
            if (event == null) {
              return Observable.empty();
            }
            return this._handleEvent(event);
          }),
        )
        .subscribe()
    );
  }

  /**
   * Returns a stream of all typing and saving operations from the editor.
   */
  _getEditorEventStream(editor: atom$TextEditor): Observable<FormatEvent> {
    const changeEvents = observableFromSubscribeFunction(callback =>
      editor.getBuffer().onDidChange(callback),
    )
      // Debounce to ensure that multiple cursors only trigger one format.
      // TODO(hansonw): Use onDidChangeText with 1.17+.
      .debounceTime(0);

    const saveEvents = Observable.create(observer => {
      const realSave = editor.save;
      // HACK: intercept the real TextEditor.save and handle it ourselves.
      // Atom has no way of injecting content into the buffer asynchronously
      // before a save operation.
      // If we try to format after the save, and then save again,
      // it's a poor user experience (and also races the text buffer's reload).
      // TODO(hansonw): Revisit this with the new 1.19 editors.
      const editor_ = (editor: any);
      editor_.save = () => {
        observer.next();
      };
      return () => {
        // Restore the save function when we're done.
        editor_.save = realSave;
      };
    });

    // We need to capture when editors are about to be destroyed in order to
    // interrupt any pending formatting operations. (Otherwise, we may end up
    // attempting to save a destroyed editor!)
    const willDestroyEvents = observableFromSubscribeFunction(cb =>
      atom.workspace.onWillDestroyPaneItem(cb),
    ).filter(event => event.item === editor);

    return Observable.merge(
      changeEvents.map(edit => ({type: 'type', editor, edit})),
      saveEvents.map(() => ({type: 'save', editor})),
    ).takeUntil(
      Observable.merge(observeEditorDestroy(editor), willDestroyEvents),
    );
  }

  _handleEvent(event: FormatEvent): Observable<void> {
    const {editor} = event;
    switch (event.type) {
      case 'command':
        return this._formatCodeInTextEditor(editor)
          .map(result => {
            if (!result) {
              throw new Error('No code formatting providers found!');
            }
          })
          .catch(err => {
            atom.notifications.addError('Failed to format code', {
              description: err.message,
            });
            return Observable.empty();
          });
      case 'type':
        return this._formatCodeOnTypeInTextEditor(
          editor,
          event.edit,
        ).catch(err => {
          logger.warn('Failed to format code on type:', err);
          return Observable.empty();
        });
      case 'save':
        return (
          this._formatCodeOnSaveInTextEditor(editor)
            .timeout(SAVE_TIMEOUT)
            .catch(err => {
              logger.warn('Failed to format code on save:', err);
              return Observable.empty();
            })
            // Fire-and-forget the original save function.
            // This is actually async for remote files, but we don't use the result.
            // NOTE: finally is important, as saves should still fire on unsubscribe.
            .finally(() => editor.getBuffer().save())
        );
      default:
        return Observable.throw(`unknown event type ${event.type}`);
    }
  }

  // Checks whether contents are same in the buffer post-format, throwing if
  // anything has changed.
  _checkContentsAreSame(before: string, after: string): void {
    if (before !== after) {
      throw new Error(
        'The file contents were changed before formatting was complete.',
      );
    }
  }

  // Formats code in the editor specified, returning whether or not a
  // code formatter completed successfully.
  _formatCodeInTextEditor(
    editor: atom$TextEditor,
    range?: atom$Range,
  ): Observable<boolean> {
    return Observable.defer(() => {
      const buffer = editor.getBuffer();
      const selectionRange = range || editor.getSelectedBufferRange();
      const {start: selectionStart, end: selectionEnd} = selectionRange;
      let formatRange = null;
      if (selectionRange.isEmpty()) {
        // If no selection is done, then, the whole file is wanted to be formatted.
        formatRange = buffer.getRange();
      } else {
        // Format selections should start at the begining of the line,
        // and include the last selected line end.
        // (If the user has already selected complete rows, then depending on how they
        // did it, their caret might be either (1) at the end of their last selected line
        // or (2) at the first column of the line AFTER their selection. In both cases
        // we snap the formatRange to end at the first column of the line after their
        // selection.)
        formatRange = new Range(
          [selectionStart.row, 0],
          selectionEnd.column === 0 ? selectionEnd : [selectionEnd.row + 1, 0],
        );
      }
      const {scopeName} = editor.getGrammar();
      const rangeProvider = this._getMatchingProviderForScopeName(
        this._rangeProviders,
        scopeName,
      );
      const fileProvider = this._getMatchingProviderForScopeName(
        this._fileProviders,
        scopeName,
      );
      const contents = editor.getText();
      if (
        rangeProvider != null &&
        // When formatting the entire file, prefer file-based providers.
        (!formatRange.isEqual(buffer.getRange()) || fileProvider == null)
      ) {
        return Observable.fromPromise(
          rangeProvider.formatCode(editor, formatRange),
        ).map(edits => {
          // Throws if contents have changed since the time of triggering format code.
          this._checkContentsAreSame(contents, editor.getText());
          if (!applyTextEditsToBuffer(editor.getBuffer(), edits)) {
            throw new Error('Could not apply edits to text buffer.');
          }
          return true;
        });
      } else if (fileProvider != null) {
        return Observable.fromPromise(
          fileProvider.formatEntireFile(editor, formatRange),
        ).map(({newCursor, formatted}) => {
          // Throws if contents have changed since the time of triggering format code.
          this._checkContentsAreSame(contents, editor.getText());
          buffer.setTextViaDiff(formatted);

          const newPosition = newCursor != null
            ? buffer.positionForCharacterIndex(newCursor)
            : editor.getCursorBufferPosition();

          // We call setCursorBufferPosition even when there is no newCursor,
          // because it unselects the text selection.
          editor.setCursorBufferPosition(newPosition);
          return true;
        });
      } else {
        return Observable.of(false);
      }
    });
  }

  _formatCodeOnTypeInTextEditor(
    editor: atom$TextEditor,
    event: atom$TextEditEvent,
  ): Observable<void> {
    return Observable.defer(() => {
      // This also ensures the non-emptiness of event.newText for below.
      if (!shouldFormatOnType(event) || !getFormatOnType()) {
        return Observable.empty();
      }
      // In the case of bracket-matching, we use the last character because that's
      // the character that will usually cause a reformat (i.e. `}` instead of `{`).
      const character = event.newText[event.newText.length - 1];

      const {scopeName} = editor.getGrammar();
      const provider = this._getMatchingProviderForScopeName(
        this._onTypeProviders,
        scopeName,
      );
      if (provider == null) {
        return Observable.empty();
      }

      const contents = editor.getText();

      // The bracket-matching package basically overwrites
      //
      //     editor.insertText('{');
      //
      // with
      //
      //     editor.insertText('{}');
      //     cursor.moveLeft();
      //
      // We want to wait until the cursor has actually moved before we issue a
      // format request, so that we format at the right position (and potentially
      // also let any other event handlers have their go).
      return nextTick
        .switchMap(() =>
          provider.formatAtPosition(
            editor,
            editor.getCursorBufferPosition().translate([0, -1]),
            character,
          ),
        )
        .map(edits => {
          if (edits.length === 0) {
            return;
          }
          this._checkContentsAreSame(contents, editor.getText());
          // Note that this modification is not in a transaction, so it applies as a
          // separate editing event than the character typing. This means that you
          // can undo just the formatting by attempting to undo once, and then undo
          // your actual code by undoing again.
          if (!applyTextEditsToBuffer(editor.getBuffer(), edits)) {
            throw new Error('Could not apply edits to text buffer.');
          }
        });
    });
  }

  _formatCodeOnSaveInTextEditor(editor: atom$TextEditor): Observable<void> {
    const {scopeName} = editor.getGrammar();
    const saveProvider = this._getMatchingProviderForScopeName(
      this._onSaveProviders,
      scopeName,
    );

    if (saveProvider != null) {
      return Observable.fromPromise(
        saveProvider.formatOnSave(editor),
      ).map(edits => {
        applyTextEditsToBuffer(editor.getBuffer(), edits);
      });
    } else if (getFormatOnSave()) {
      return this._formatCodeInTextEditor(
        editor,
        editor.getBuffer().getRange(),
      ).ignoreElements();
    }
    return Observable.empty();
  }

  _getMatchingProviderForScopeName<T: CodeFormatProvider>(
    providers: Array<T>,
    scopeName: string,
  ): ?T {
    return providers.find(provider => {
      const providerGrammars = provider.selector.split(/, ?/);
      return (
        provider.inclusionPriority > 0 &&
        providerGrammars.indexOf(scopeName) !== -1
      );
    });
  }

  addRangeProvider(provider: RangeCodeFormatProvider): IDisposable {
    return this._addProvider(this._rangeProviders, provider);
  }

  addFileProvider(provider: FileCodeFormatProvider): IDisposable {
    return this._addProvider(this._fileProviders, provider);
  }

  addOnTypeProvider(provider: OnTypeCodeFormatProvider): IDisposable {
    return this._addProvider(this._onTypeProviders, provider);
  }

  addOnSaveProvider(provider: OnSaveCodeFormatProvider): IDisposable {
    return this._addProvider(this._onSaveProviders, provider);
  }

  _addProvider<T: CodeFormatProvider>(
    providers: Array<T>,
    provider: T,
  ): IDisposable {
    providers.push(provider);
    providers.sort((a, b) => b.inclusionPriority - a.inclusionPriority);
    return new UniversalDisposable(() => {
      const index = providers.indexOf(provider);
      if (index !== -1) {
        providers.splice(index);
      }
    });
  }

  dispose() {
    this._subscriptions.dispose();
  }
}

function shouldFormatOnType(event: atom$TextEditEvent): boolean {
  // There's not a direct way to figure out what caused this edit event. There
  // are three cases that we want to pay attention to:
  //
  // 1) The user typed a character.
  // 2) The user typed a character, and bracket-matching kicked in, causing
  //    there to be two characters typed.
  // 3) The user pasted a string.
  //
  // We only want to trigger autoformatting in the first two cases. However,
  // we can only look at what new string was inserted, and not what actually
  // caused the event, so we just use some heuristics to determine which of
  // these the event probably was depending on what was typed. This means, for
  // example, we may issue spurious format requests when the user pastes a
  // single character, but this is acceptable.
  if (event.oldText !== '') {
    // We either just deleted something or replaced a selection. For the time
    // being, we're not going to issue a reformat in that case.
    return false;
  } else if (event.oldText === '' && event.newText === '') {
    // Not sure what happened here; why did we get an event in this case? Bail
    // for safety.
    return false;
  } else if (event.newText.length > 1 && !isBracketPair(event.newText)) {
    return false;
  }
  return true;
}

/**
 * We can't tell the difference between a paste and the bracket-matcher package
 * inserting an extra bracket, so we just assume that any pair of brackets that
 * bracket-matcher recognizes was a pair matched by the package.
 */
function isBracketPair(typedText: string): boolean {
  if (atom.packages.getActivePackage('bracket-matcher') == null) {
    return false;
  }
  const validBracketPairs: Array<string> = (atom.config.get(
    'bracket-matcher.autocompleteCharacters',
  ): any);
  return validBracketPairs.indexOf(typedText) !== -1;
}
