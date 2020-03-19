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

/**
 * ActiveEditorRegistry provides abstractions for creating services that operate
 * on text editor contents.
 */

import {Observable, Subject} from 'rxjs';
import {observeActiveEditorsDebounced} from './debounced';
import UniversalDisposable from 'nuclide-commons/UniversalDisposable';
import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {cacheWhileSubscribed} from 'nuclide-commons/observable';

import {getLogger} from 'log4js';

import {isPending, observePendingStateEnd} from './pane-item';
import ProviderRegistry from './ProviderRegistry';

export type Provider = {
  priority: number,
  +grammarScopes?: Array<string>,
};

export type Result<T, V> =
  | {
      kind: 'not-text-editor',
    }
  | {
      kind: 'no-provider',
      grammar: atom$Grammar,
    }
  | {
      kind: 'provider-error',
      provider: T,
    }
  | {
      // Since providers can be slow, the pane-change and edit events are emitted immediately in case
      // the UI needs to clear outdated results.
      kind: 'pane-change',
      editor: atom$TextEditor,
    }
  | {
      kind: 'save',
      editor: atom$TextEditor,
    }
  | {
      kind: 'result',
      result: V,
      // The editor that the result was computed from
      editor: atom$TextEditor,
      // The provider that computed the result
      // TODO Use a type parameter for this type
      provider: T,
    };

export type ResultFunction<T, V> = (
  provider: T,
  editor: atom$TextEditor,
) => Promise<V>;

type PartialEventSources = {
  +activeEditors?: Observable<?atom$TextEditor>,
  +savesForEditor?: (editor: atom$TextEditor) => Observable<void>,
};

export type EventSources = {
  activeEditors: Observable<?atom$TextEditor>,
  savesForEditor: (editor: atom$TextEditor) => Observable<void>,
};

export default class ActiveEditorRegistry<T: Provider, V> {
  _resultFunction: ResultFunction<T, V>;
  _providerRegistry: ProviderRegistry<T>;
  _newProviderEvents: Subject<void>;
  _resultsStream: Observable<Result<T, V>>;

  constructor(
    resultFunction: ResultFunction<T, V>,
    eventSources: PartialEventSources = {},
  ) {
    this._resultFunction = resultFunction;
    this._providerRegistry = new ProviderRegistry();
    this._newProviderEvents = new Subject();
    this._resultsStream = this._createResultsStream({
      activeEditors:
        eventSources.activeEditors || observeActiveEditorsDebounced(),
      savesForEditor:
        eventSources.savesForEditor ||
        (editor => {
          return observableFromSubscribeFunction(callback =>
            editor.onDidSave(callback),
          ).mapTo(undefined);
        }),
    });
  }

  consumeProvider(provider: T): IDisposable {
    this._providerRegistry.addProvider(provider);
    this._newProviderEvents.next();
    return new UniversalDisposable(() => {
      this._providerRegistry.removeProvider(provider);
    });
  }

  getResultsStream(): Observable<Result<T, V>> {
    return this._resultsStream;
  }

  _createResultsStream(eventSources: EventSources): Observable<Result<T, V>> {
    const repeatedEditors = eventSources.activeEditors.switchMap(editor => {
      if (editor == null) {
        return Observable.of(editor);
      }
      return Observable.concat(
        Observable.of(editor),
        this._newProviderEvents.mapTo(editor),
      );
    });
    const results = repeatedEditors.switchMap(editorArg => {
      // Necessary so the type refinement holds in the callback later
      const editor = editorArg;
      if (editor == null) {
        return Observable.of({kind: 'not-text-editor'});
      }

      return Observable.concat(
        // Emit a pane change event first, so that clients can do something while waiting for a
        // provider to give a result.
        Observable.of({
          kind: 'pane-change',
          editor,
        }),
        // wait for pending panes to no longer be pending, or if they're not,
        // get the result right away.
        (isPending(editor)
          ? observePendingStateEnd(editor).take(1)
          : Observable.of(null)
        ).ignoreElements(),
        Observable.fromPromise(
          this._getResultForEditor(this._getProvidersForEditor(editor), editor),
        ),
        this._resultsForEditor(editor, eventSources),
      );
    });
    return cacheWhileSubscribed(results);
  }

  _resultsForEditor(
    editor: atom$TextEditor,
    eventSources: EventSources,
  ): Observable<Result<T, V>> {
    // It's possible that the active provider for an editor changes over time.
    // Thus, we have to subscribe to both edits and saves.
    return Observable.merge(
      eventSources.savesForEditor(editor).map(() => 'save'),
    ).flatMap(event => {
      const providers = this._getProvidersForEditor(editor);
      return Observable.concat(
        // $FlowIssue: {kind: save}
        Observable.of({kind: event, editor}),
        Observable.fromPromise(this._getResultForEditor(providers, editor)),
      );
    });
  }

  _getProvidersForEditor(editor: atom$TextEditor): Array<T> {
    return [...this._providerRegistry.getAllProvidersForEditor(editor)];
  }

  async _getResultForEditor(
    providers: Array<T>,
    editor: atom$TextEditor,
  ): Promise<Result<T, V>> {
    if (providers.length === 0) {
      return {
        kind: 'no-provider',
        grammar: editor.getGrammar(),
      };
    }
    let errorResult;
    const results = await Promise.all(
      providers.map(async provider => {
        try {
          return await this._resultFunction(provider, editor);
        } catch (error) {
          getLogger(this.constructor.name).error(
            `Error from provider for ${editor.getGrammar().scopeName}`,
            error,
          );
          errorResult = {
            provider,
            kind: 'provider-error',
          };
        }
      }),
    );
    if (errorResult != null) {
      return errorResult;
    }
    const resultIndex = results.findIndex(r => r != null);
    return {
      kind: 'result',
      result: (results[resultIndex]: any),
      provider: providers[resultIndex] || providers[0],
      editor,
    };
  }
}
