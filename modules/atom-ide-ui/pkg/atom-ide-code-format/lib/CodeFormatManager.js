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

import type {TextEdit} from 'nuclide-commons-atom/text-edit';
import type {BusySignalService} from '../../atom-ide-busy-signal/lib/types';
import type {
  FileCodeFormatProvider,
  OnSaveCodeFormatProvider,
  OnTypeCodeFormatProvider,
  RangeCodeFormatProvider,
} from './types';

import nullthrows from 'nullthrows';
import {registerOnWillSave} from 'nuclide-commons-atom/FileEventHandlers';
import {getFormatOnSave, getFormatOnType} from './config';
import {Range} from 'atom';
import {getLogger} from 'log4js';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import {applyTextEditsToBuffer} from 'nuclide-commons-atom/text-edit';
import {observeEditorDestroy} from 'nuclide-commons-atom/text-editor';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import nuclideUri from 'nuclide-commons/nuclideUri';
import {completingSwitchMap, microtask} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable} from 'rxjs';

// Save events are critical, so don't allow providers to block them.
export const SAVE_TIMEOUT = 2500;

type FormatEvent =
  | {
      type: 'command' | 'save' | 'new-save',
      editor: atom$TextEditor,
    }
  | {
      type: 'type',
      editor: atom$TextEditor,
      edit: atom$AggregatedTextEditEvent,
    };

export default class CodeFormatManager {
  _subscriptions: UniversalDisposable;
  _rangeProviders: ProviderRegistry<RangeCodeFormatProvider>;
  _fileProviders: ProviderRegistry<FileCodeFormatProvider>;
  _onTypeProviders: ProviderRegistry<OnTypeCodeFormatProvider>;
  _onSaveProviders: ProviderRegistry<OnSaveCodeFormatProvider>;
  _busySignalService: ?BusySignalService;

  constructor() {
    this._subscriptions = new UniversalDisposable(
      this._subscribeToEvents(),
      registerOnWillSave(this._onWillSaveProvider()),
    );
    this._rangeProviders = new ProviderRegistry();
    this._fileProviders = new ProviderRegistry();
    this._onTypeProviders = new ProviderRegistry();
    this._onSaveProviders = new ProviderRegistry();
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
        'code-format:format-code',
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
    const editorEvents = observableFromSubscribeFunction(cb =>
      atom.workspace.observeTextEditors(cb),
    ).mergeMap(editor => this._getEditorEventStream(editor));

    return (
      Observable.merge(commandEvents, editorEvents)
        // Group events by buffer to prevent simultaneous formatting operations.
        .groupBy(
          event => event.editor.getBuffer(),
          event => event,
          grouped =>
            observableFromSubscribeFunction(callback =>
              grouped.key.onDidDestroy(callback),
            ),
        )
        .mergeMap(events =>
          // Make sure we halt everything when the editor gets destroyed.
          events.let(completingSwitchMap(event => this._handleEvent(event))),
        )
        .subscribe()
    );
  }

  /**
   * Returns a stream of all typing and saving operations from the editor.
   */
  _getEditorEventStream(editor: atom$TextEditor): Observable<FormatEvent> {
    const changeEvents = observableFromSubscribeFunction(callback =>
      editor.getBuffer().onDidChangeText(callback),
    );

    // We need to capture when editors are about to be destroyed in order to
    // interrupt any pending formatting operations. (Otherwise, we may end up
    // attempting to save a destroyed editor!)
    const willDestroyEvents = observableFromSubscribeFunction(cb =>
      atom.workspace.onWillDestroyPaneItem(cb),
    ).filter(event => event.item === editor);

    return Observable.merge(
      changeEvents.map(edit => ({type: 'type', editor, edit})),
    ).takeUntil(
      Observable.merge(observeEditorDestroy(editor), willDestroyEvents),
    );
  }

  _handleEvent(event: FormatEvent): Observable<mixed> {
    const {editor} = event;
    switch (event.type) {
      case 'command':
        return this._formatCodeInTextEditor(editor)
          .do(edits => {
            applyTextEditsToBuffer(editor.getBuffer(), edits);
          })
          .map(result => {
            if (!result) {
              throw new Error('No code formatting providers found!');
            }
          })
          .catch(err => {
            atom.notifications.addError(
              `Failed to format code: ${err.message}`,
              {
                detail: err.detail,
              },
            );
            return Observable.empty();
          });
      case 'type':
        return this._formatCodeOnTypeInTextEditor(editor, event.edit).catch(
          err => {
            getLogger('code-format').warn(
              'Failed to format code on type:',
              err,
            );
            return Observable.empty();
          },
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

  // Return the text edits used to format code in the editor specified.
  _formatCodeInTextEditor(
    editor: atom$TextEditor,
    range?: atom$Range,
  ): Observable<Array<TextEdit>> {
    return Observable.defer(() => {
      const buffer = editor.getBuffer();
      const selectionRange = range || editor.getSelectedBufferRange();
      const {start: selectionStart, end: selectionEnd} = selectionRange;
      let formatRange: atom$Range;
      if (selectionRange.isEmpty()) {
        // If no selection is done, then, the whole file is wanted to be formatted.
        formatRange = buffer.getRange();
      } else {
        // Format selections should start at the beginning of the line,
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
      const rangeProviders = [
        ...this._rangeProviders.getAllProvidersForEditor(editor),
      ];
      const fileProviders = [
        ...this._fileProviders.getAllProvidersForEditor(editor),
      ];
      const contents = editor.getText();
      const rangeEdits = Observable.defer(() =>
        this._reportBusy(
          editor,
          Promise.all(
            rangeProviders.map(p => p.formatCode(editor, formatRange)),
          ),
        ),
      ).switchMap(allEdits => {
        const firstNonEmpty = allEdits.find(edits => edits.length > 0);
        if (firstNonEmpty == null) {
          return Observable.empty();
        } else {
          return Observable.of(firstNonEmpty);
        }
      });
      const fileEdits = Observable.defer(() =>
        this._reportBusy(
          editor,
          Promise.all(
            fileProviders.map(p => p.formatEntireFile(editor, formatRange)),
          ),
        ),
      )
        .switchMap(allResults => {
          const firstNonNull = allResults.find(result => result != null);
          if (firstNonNull == null) {
            return Observable.empty();
          } else {
            return Observable.of(firstNonNull);
          }
        })
        .map(({_, formatted}) => {
          return [
            {
              oldRange: editor.getBuffer().getRange(),
              newText: formatted,
              oldText: contents,
            },
          ];
        });
      // When formatting the entire file, prefer file-based providers.
      const preferFileEdits = formatRange.isEqual(buffer.getRange());
      const edits = preferFileEdits
        ? fileEdits.concat(rangeEdits)
        : rangeEdits.concat(fileEdits);
      return edits.first(Boolean, []);
    });
  }

  _formatCodeOnTypeInTextEditor(
    editor: atom$TextEditor,
    aggregatedEvent: atom$AggregatedTextEditEvent,
  ): Observable<Array<TextEdit>> {
    return Observable.defer(() => {
      // Don't try to format changes with multiple cursors.
      if (aggregatedEvent.changes.length !== 1) {
        return Observable.empty();
      }
      const event = aggregatedEvent.changes[0];
      // This also ensures the non-emptiness of event.newText for below.
      if (!shouldFormatOnType(event) || !getFormatOnType()) {
        return Observable.empty();
      }
      // In the case of bracket-matching, we use the last character because that's
      // the character that will usually cause a reformat (i.e. `}` instead of `{`).
      const character = event.newText[event.newText.length - 1];

      const providers = [
        ...this._onTypeProviders.getAllProvidersForEditor(editor),
      ];
      if (providers.length === 0) {
        return Observable.empty();
      }

      const contents = editor.getText();
      const cursorPosition = editor.getCursorBufferPosition().copy();

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
      return microtask
        .switchMap(() =>
          Promise.all(
            providers.map(p =>
              p.formatAtPosition(
                editor,
                editor.getCursorBufferPosition(),
                character,
              ),
            ),
          ),
        )
        .switchMap(allEdits => {
          const firstNonEmptyIndex = allEdits.findIndex(
            edits => edits.length > 0,
          );
          if (firstNonEmptyIndex === -1) {
            return Observable.empty();
          } else {
            return Observable.of({
              edits: nullthrows(allEdits[firstNonEmptyIndex]),
              provider: providers[firstNonEmptyIndex],
            });
          }
        })
        .do(({edits, provider}) => {
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

          if (provider.keepCursorPosition) {
            editor.setCursorBufferPosition(cursorPosition);
          }
        })
        .map(({edits}) => edits);
    });
  }

  _onWillSaveProvider() {
    return {
      priority: 0,
      timeout: SAVE_TIMEOUT,
      callback: this._formatCodeOnSaveInTextEditor.bind(this),
    };
  }

  _formatCodeOnSaveInTextEditor(editor: atom$TextEditor): Observable<TextEdit> {
    const saveProviders = [
      ...this._onSaveProviders.getAllProvidersForEditor(editor),
    ];
    if (saveProviders.length > 0) {
      return Observable.defer(() =>
        this._reportBusy(
          editor,
          Promise.all(saveProviders.map(p => p.formatOnSave(editor))),
          false,
        ),
      )
        .switchMap(allEdits => {
          const firstNonEmpty = allEdits.find(edits => edits.length > 0);
          if (firstNonEmpty == null) {
            return Observable.empty();
          } else {
            return Observable.of(firstNonEmpty);
          }
        })
        .flatMap(edits => Observable.of(...edits));
    } else if (getFormatOnSave(editor)) {
      return this._formatCodeInTextEditor(
        editor,
        editor.getBuffer().getRange(),
      ).flatMap(edits => Observable.of(...edits));
    }
    return Observable.empty();
  }

  _reportBusy<T>(
    editor: atom$TextEditor,
    promise: Promise<T>,
    revealTooltip?: boolean = true,
  ): Promise<T> {
    const busySignalService = this._busySignalService;
    if (busySignalService != null) {
      const path = editor.getPath();
      const displayPath =
        path != null ? nuclideUri.basename(path) : '<untitled>';
      return busySignalService.reportBusyWhile(
        `Formatting code in ${displayPath}`,
        () => promise,
        {revealTooltip},
      );
    }
    return promise;
  }

  addRangeProvider(provider: RangeCodeFormatProvider): IDisposable {
    return this._rangeProviders.addProvider(provider);
  }

  addFileProvider(provider: FileCodeFormatProvider): IDisposable {
    return this._fileProviders.addProvider(provider);
  }

  addOnTypeProvider(provider: OnTypeCodeFormatProvider): IDisposable {
    return this._onTypeProviders.addProvider(provider);
  }

  addOnSaveProvider(provider: OnSaveCodeFormatProvider): IDisposable {
    return this._onSaveProviders.addProvider(provider);
  }

  consumeBusySignal(busySignalService: BusySignalService): IDisposable {
    this._busySignalService = busySignalService;
    return new UniversalDisposable(() => {
      this._busySignalService = null;
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
