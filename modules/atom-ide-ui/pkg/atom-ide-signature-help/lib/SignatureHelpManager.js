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

import type {DatatipService} from '../../atom-ide-datatip/lib/types';
import type {SignatureHelp, SignatureHelpProvider} from './types';

import {getLogger} from 'log4js';
import {observeActiveEditorsDebounced} from 'nuclide-commons-atom/debounced';
import {getCursorPositions} from 'nuclide-commons-atom/text-editor';
import ProviderRegistry from 'nuclide-commons-atom/ProviderRegistry';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {completingSwitchMap, fastDebounce} from 'nuclide-commons/observable';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {Observable, Subject} from 'rxjs';
import getSignatureDatatip from './getSignatureDatatip';

// Chosen to be a little more than the default key repeat rate.
const CURSOR_DEBOUNCE_TIME = 200;

// Aggressively timeout signature requests to avoid 'stuck' signatures.
const SIGNATURE_TIMEOUT = 2500;

export default class SignatureHelpManager {
  _disposables: UniversalDisposable;
  _datatipService: ?DatatipService;
  _providerRegistry: ProviderRegistry<SignatureHelpProvider>;
  _commands: Subject<?atom$TextEditor> = new Subject();

  constructor() {
    this._providerRegistry = new ProviderRegistry();
    this._disposables = new UniversalDisposable(
      this._subscribeToEditors(),
      // Share the command subscription between all editors.
      atom.commands.add('atom-text-editor', 'signature-help:show', () => {
        this._commands.next(atom.workspace.getActiveTextEditor());
      }),
    );
  }

  dispose() {
    this._disposables.dispose();
  }

  setDatatipService(service: ?DatatipService) {
    this._datatipService = service;
  }

  consumeSignatureHelp(provider: SignatureHelpProvider) {
    return this._providerRegistry.addProvider(provider);
  }

  /**
   * The signature help flow looks like this:
   * 1) Wait for signature help to be triggered.
   *    This means that the user types a character matching triggerCharacters
   *    from at least one provider, or they activate the Atom command.
   * 2) Once signature help is triggered, we start fetching signatures for the cursor location.
   *    New signatures are continously fetched as the cursor moves.
   * 3) Signature help stops once we get a null signature, or once the user hits 'escape'.
   */
  _subscribeToEditors(): rxjs$Subscription {
    return observeActiveEditorsDebounced(0)
      .switchMap(editor => {
        if (editor == null) {
          return Observable.of({editor, signatureHelp: null});
        }
        return this._signatureHelpTriggers(editor)
          .exhaustMap(() => this._getSignatureStream(editor))
          .takeUntil(
            observableFromSubscribeFunction(editor.onDidDestroy.bind(editor)),
          )
          .map(signatureHelp => ({editor, signatureHelp}));
      })
      .switchMap(({editor, signatureHelp}) => {
        if (editor != null && signatureHelp != null) {
          return this._showSignatureDatatip(editor, signatureHelp);
        }
        return Observable.empty();
      })
      .subscribe();
  }

  /**
   * A stream of all signature help triggers.
   */
  _signatureHelpTriggers(editor: atom$TextEditor): Observable<mixed> {
    return Observable.merge(
      // 1) Any keypresses that match a triggerCharacter.
      observableFromSubscribeFunction(cb =>
        editor.getBuffer().onDidChangeText(cb),
      )
        // The change events and cursor changes are often sequential.
        // We need to make sure we use the final cursor position.
        .let(fastDebounce(0))
        .filter(edit => {
          if (edit.changes.length !== 1) {
            return false;
          }
          const change = edit.changes[0];
          if (
            // Only handle single/double-character insertions.
            // (e.g. bracket-matcher inserts two characters on open parenthesis)
            change.newText.length === 0 ||
            change.newText.length > 2 ||
            // The change should cover the current cursor position.
            !change.newRange.containsPoint(editor.getCursorBufferPosition())
          ) {
            return false;
          }
          for (const provider of this._providerRegistry.getAllProvidersForEditor(
            editor,
          )) {
            if (provider.triggerCharacters != null) {
              for (let i = 0; i < change.newText.length; i++) {
                if (provider.triggerCharacters.has(change.newText[i])) {
                  return true;
                }
              }
            }
          }
          return false;
        }),
      // 2) Explicit usage of the Atom command.
      this._commands.filter(e => e === editor),
    );
  }

  /**
   * A stream of all signatures from an editor.
   */
  _getSignatureStream(editor: atom$TextEditor): Observable<?SignatureHelp> {
    return Observable.concat(
      // Start with a null signature to clear out any prior signatures.
      Observable.of(null),
      // Immediately start fetching signatures for the current position.
      Observable.concat(
        Observable.defer(() => Observable.of(editor.getCursorBufferPosition())),
        // Further cursor changes will be debounced.
        getCursorPositions(editor).let(fastDebounce(CURSOR_DEBOUNCE_TIME)),
      )
        .distinctUntilChanged((a, b) => a.isEqual(b))
        .switchMap(point => this._getSignatures(editor, point))
        // Stop once we get a null result.
        .takeWhile(Boolean)
        // Stop once the escape key is pressed.
        // NOTE: we can't use core:cancel because plugins like vim-mode-plus override it.
        .takeUntil(
          Observable.fromEvent(editor.getElement(), 'keydown').filter(
            (evt: KeyboardEvent) => evt.keyCode === 27,
          ),
        ),
      // Terminate with a null signature to clear any visible signatures.
      Observable.of(null),
    );
  }

  /**
   * Retrieve a signature from all providers for an editor + point.
   * (Effectively just a cancellable promise).
   */
  _getSignatures(
    editor: atom$TextEditor,
    point: atom$Point,
  ): Observable<?SignatureHelp> {
    // Take the highest-priority non-empty result.
    return Observable.defer(() =>
      Observable.from(this._providerRegistry.getAllProvidersForEditor(editor)),
    )
      .concatMap(provider => {
        return provider.getSignatureHelp(editor, point).catch(err => {
          const editorPath = editor.getPath() || '<untitled editor>';
          getLogger('atom-ide-signature-help').error(
            `Caught error from signature help provider for ${editorPath}`,
            err,
          );
          return null;
        });
      })
      .filter(x => x != null && x.signatures.length > 0)
      .timeoutWith(SIGNATURE_TIMEOUT, Observable.of(null))
      .take(1)
      .defaultIfEmpty(null);
  }

  /**
   * Displays the signature datatip and wraps its lifetime in an Observable.
   */
  _showSignatureDatatip(
    editor: atom$TextEditor,
    signatureHelp: SignatureHelp,
  ): Observable<mixed> {
    return Observable.defer(() => {
      const datatipService = this._datatipService;
      if (datatipService == null || signatureHelp.signatures.length === 0) {
        return Observable.empty();
      }

      const currentPosition = editor.getCursorBufferPosition();
      // Make sure the datatip follows the cursor position.
      return (
        getCursorPositions(editor)
          // But don't go too far.
          .takeWhile(
            position =>
              Math.abs(currentPosition.row - position.row) +
                Math.abs(currentPosition.column - position.column) <=
              2,
          )
          .let(
            completingSwitchMap(point => {
              return Observable.create(() => {
                const disposable = datatipService.createPinnedDataTip(
                  getSignatureDatatip(signatureHelp, point),
                  editor,
                  {
                    position: 'above-range',
                    showRangeHighlight: false,
                  },
                );
                return new UniversalDisposable(disposable);
              });
            }),
          )
      );
    });
  }
}
