/**
 * Copyright (c) 2015-present, Facebook, Inc.
 * All rights reserved.
 *
 * This source code is licensed under the license found in the LICENSE file in
 * the root directory of this source tree.
 *
 * @flow strict
 * @format
 */

export type AtomAutocompleteProvider = AutocompleteProvider<
  atom$AutocompleteSuggestion,
>;

export type AutocompleteProvider<
  Suggestion: atom$AutocompleteSuggestion,
> = AutocompleteProviderBase<Suggestion> & {
  analytics: AutocompleteAnalytics,
};

type AutocompleteProviderBase<Suggestion: atom$AutocompleteSuggestion> = {
  +selector: string,
  +getSuggestions: (
    request: atom$AutocompleteRequest,
  ) => Promise<?Array<Suggestion>> | ?Array<Suggestion>,
  +getSuggestionDetailsOnSelect?: (
    suggestion: Suggestion,
  ) => Promise<?Suggestion>,
  +disableForSelector?: string,
  +inclusionPriority?: number,
  +excludeLowerPriority?: boolean,
  +suggestionPriority?: number,
  +filterSuggestions?: boolean,
  +disposable?: () => void,
  +onDidInsertSuggestion?: (
    insertedSuggestion: AtomSuggestionInsertedRequest<Suggestion>,
  ) => void,
};

export type AtomSuggestionInsertedRequest<
  Suggestion: atom$AutocompleteSuggestion,
> = {
  +editor: atom$TextEditor,
  +triggerPosition: atom$Point,
  +suggestion: Suggestion,
};

export type AutocompleteAnalytics = {|
  +eventName: string,
  +shouldLogInsertedSuggestion: boolean,
|};

export type AutocompleteAnalyticEventNames = {|
  +errorOnGetSuggestions: string,
  +onDidInsertSuggestion: string,
  +onGetSuggestions: string,
  +errorOnGetSuggestionDetailsOnSelect: string,
  +onGetSuggestionDetailsOnSelect: string,
  +timeoutOnGetSuggestions: string,
|};
