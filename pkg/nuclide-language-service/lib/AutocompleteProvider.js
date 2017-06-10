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
  AutocompleteCacherConfig,
} from '../../commons-atom/AutocompleteCacher';

import type {
  AutocompleteResult,
  Completion,
  LanguageService,
} from './LanguageService';

import {ConnectionCache} from '../../nuclide-remote-connection';
import {trackTiming, track} from '../../nuclide-analytics';
import {getFileVersionOfEditor} from '../../nuclide-open-files';
import AutocompleteCacher from '../../commons-atom/AutocompleteCacher';

export type OnDidInsertSuggestionArgument = {
  editor: atom$TextEditor,
  triggerPosition: atom$Point,
  suggestion: Completion,
};

export type OnDidInsertSuggestionCallback = (
  arg: OnDidInsertSuggestionArgument,
) => mixed;

export type AutocompleteConfig = {|
  inclusionPriority: number,
  suggestionPriority: number,
  disableForSelector: ?string,
  excludeLowerPriority: boolean,
  version: '2.0.0',
  analyticsEventName: string,
  onDidInsertSuggestionAnalyticsEventName: string,
  autocompleteCacherConfig: ?AutocompleteCacherConfig<AutocompleteResult>,
|};

export class AutocompleteProvider<T: LanguageService> {
  name: string;
  selector: string;
  inclusionPriority: number;
  suggestionPriority: number;
  disableForSelector: ?string;
  excludeLowerPriority: boolean;
  _onDidInsertSuggestion: ?OnDidInsertSuggestionCallback;
  onDidInsertSuggestion: OnDidInsertSuggestionCallback;
  _analyticsEventName: string;
  _connectionToLanguageService: ConnectionCache<T>;
  _autocompleteCacher: ?AutocompleteCacher<AutocompleteResult>;

  constructor(
    name: string,
    selector: string,
    inclusionPriority: number,
    suggestionPriority: number,
    disableForSelector: ?string,
    excludeLowerPriority: boolean,
    analyticsEventName: string,
    onDidInsertSuggestion: ?OnDidInsertSuggestionCallback,
    onDidInsertSuggestionAnalyticsEventName: string,
    autocompleteCacherConfig: ?AutocompleteCacherConfig<AutocompleteResult>,
    connectionToLanguageService: ConnectionCache<T>,
  ) {
    this.name = name;
    this.selector = selector;
    this.inclusionPriority = inclusionPriority;
    this.suggestionPriority = suggestionPriority;
    this.disableForSelector = disableForSelector;
    this.excludeLowerPriority = excludeLowerPriority;
    this._analyticsEventName = analyticsEventName;
    this._connectionToLanguageService = connectionToLanguageService;

    if (autocompleteCacherConfig != null) {
      this._autocompleteCacher = new AutocompleteCacher(
        request => this._getSuggestionsFromLanguageService(request),
        autocompleteCacherConfig,
      );
    }

    this._onDidInsertSuggestion = onDidInsertSuggestion;

    this.onDidInsertSuggestion = arg => {
      track(onDidInsertSuggestionAnalyticsEventName);
      if (this._onDidInsertSuggestion != null) {
        this._onDidInsertSuggestion(arg);
      }
    };
  }

  static register(
    name: string,
    grammars: Array<string>,
    config: AutocompleteConfig,
    onDidInsertSuggestion: ?OnDidInsertSuggestionCallback,
    connectionToLanguageService: ConnectionCache<T>,
  ): IDisposable {
    return atom.packages.serviceHub.provide(
      'autocomplete.provider',
      config.version,
      new AutocompleteProvider(
        name,
        grammars.map(grammar => '.' + grammar).join(', '),
        config.inclusionPriority,
        config.suggestionPriority,
        config.disableForSelector,
        config.excludeLowerPriority,
        config.analyticsEventName,
        onDidInsertSuggestion,
        config.onDidInsertSuggestionAnalyticsEventName,
        config.autocompleteCacherConfig,
        connectionToLanguageService,
      ),
    );
  }

  getSuggestions(
    request: atom$AutocompleteRequest,
  ): Promise<?Array<Completion>> {
    return trackTiming(this._analyticsEventName, async () => {
      let result;
      if (this._autocompleteCacher != null) {
        result = await this._autocompleteCacher.getSuggestions(request);
      } else {
        result = await this._getSuggestionsFromLanguageService(request);
      }
      return result != null ? result.items : null;
    });
  }

  async _getSuggestionsFromLanguageService(
    request: atom$AutocompleteRequest,
  ): Promise<?AutocompleteResult> {
    const {editor, activatedManually, prefix} = request;
    const position = editor.getLastCursor().getBufferPosition();
    const path = editor.getPath();
    const fileVersion = await getFileVersionOfEditor(editor);

    const languageService = this._connectionToLanguageService.getForUri(path);
    if (languageService == null || fileVersion == null) {
      return {isIncomplete: false, items: []};
    }

    return (await languageService).getAutocompleteSuggestions(
      fileVersion,
      position,
      activatedManually == null ? false : activatedManually,
      prefix,
    );
  }
}
