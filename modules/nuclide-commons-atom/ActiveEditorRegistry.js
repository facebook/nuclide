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

import {Disposable} from 'atom';
import {Observable, Subject} from 'rxjs';

import {
  observeActiveEditorsDebounced,
  editorChangesDebounced,
} from './debounced';

import {observableFromSubscribeFunction} from 'nuclide-commons/event';
import {cacheWhileSubscribed} from 'nuclide-commons/observable';

import {getLogger} from 'log4js';

import ProviderRegistry from './ProviderRegistry';

export type Provider = {
  priority: number,
  grammarScopes: Array<string>,
  // This overrides the updateOnEdit setting in ActiveEditorRegistry's config.
  updateOnEdit?: boolean,
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
      kind: 'edit',
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
      // TODO Use a type paramater for this type
      provider: T,
    };

export type ResultFunction<T, V> = (
  provider: T,
  editor: atom$TextEditor,
) => Promise<V>;

type PartialEventSources = {
  +activeEditors?: Observable<?atom$TextEditor>,
  +changesForEditor?: (editor: atom$TextEditor) => Observable<void>,
  +savesForEditor?: (editor: atom$TextEditor) => Observable<void>,
};

export type EventSources = {
  activeEditors: Observable<?atom$TextEditor>,
  changesForEditor: (editor: atom$TextEditor) => Observable<void>,
  savesForEditor: (editor: atom$TextEditor) => Observable<void>,
};

export type Config = {
  /**
   * If true, we will query providers for updates whenever the text in the editor is changed.
   * Otherwise, we will query only when there is a save event.
   */
  updateOnEdit?: boolean,
};

type ConcreteConfig = {
  updateOnEdit: boolean,
};

const DEFAULT_CONFIG: ConcreteConfig = {
  updateOnEdit: true,
};

function getConcreteConfig(config: Config): ConcreteConfig {
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}

export default class ActiveEditorRegistry<T: Provider, V> {
  _resultFunction: ResultFunction<T, V>;
  _providerRegistry: ProviderRegistry<T>;
  _newProviderEvents: Subject<void>;
  _resultsStream: Observable<Result<T, V>>;
  _config: ConcreteConfig;

  constructor(
    resultFunction: ResultFunction<T, V>,
    config: Config = {},
    eventSources: PartialEventSources = {},
  ) {
    this._config = getConcreteConfig(config);
    this._resultFunction = resultFunction;
    this._providerRegistry = new ProviderRegistry();
    this._newProviderEvents = new Subject();
    this._resultsStream = this._createResultsStream({
      activeEditors:
        eventSources.activeEditors || observeActiveEditorsDebounced(),
      changesForEditor:
        eventSources.changesForEditor ||
        (editor => editorChangesDebounced(editor)),
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
    return new Disposable(() => {
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
        Observable.fromPromise(
          this._getResultForEditor(this._getProviderForEditor(editor), editor),
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
      eventSources.changesForEditor(editor).map(() => 'edit'),
      eventSources.savesForEditor(editor).map(() => 'save'),
    ).flatMap(event => {
      const provider = this._getProviderForEditor(editor);
      if (provider != null) {
        let updateOnEdit = provider.updateOnEdit;
        // Fall back to the config's updateOnEdit if not provided.
        if (updateOnEdit == null) {
          updateOnEdit = this._config.updateOnEdit;
        }
        if (updateOnEdit !== (event === 'edit')) {
          return Observable.empty();
        }
      }
      return Observable.concat(
        // $FlowIssue: {kind: edit | save} <=> {kind: edit} | {kind: save}
        Observable.of({kind: event, editor}),
        Observable.fromPromise(this._getResultForEditor(provider, editor)),
      );
    });
  }

  _getProviderForEditor(editor: atom$TextEditor): ?T {
    return this._providerRegistry.getProviderForEditor(editor);
  }

  async _getResultForEditor(
    provider: ?T,
    editor: atom$TextEditor,
  ): Promise<Result<T, V>> {
    if (provider == null) {
      return {
        kind: 'no-provider',
        grammar: editor.getGrammar(),
      };
    }
    try {
      return {
        kind: 'result',
        result: await this._resultFunction(provider, editor),
        provider,
        editor,
      };
    } catch (e) {
      getLogger(this.constructor.name).error(
        `Error from provider for ${editor.getGrammar().scopeName}`,
        e,
      );
      return {
        provider,
        kind: 'provider-error',
      };
    }
  }
}
